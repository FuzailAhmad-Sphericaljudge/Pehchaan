import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 5000);
const publicDir = path.resolve(process.cwd(), 'public');
const isProduction = process.env.NODE_ENV === 'production';
const allowDemoOtp = !isProduction && process.env.ALLOW_DEMO_OTP !== 'false';
const otpTtlMs = 10 * 60 * 1000;
const maxOtpAttempts = 5;
const jwtSecret = process.env.JWT_SECRET || (isProduction ? '' : 'local-development-secret-change-me');
if (isProduction && !jwtSecret) throw new Error('JWT_SECRET must be configured in production.');

const workers = new Map();
const wageEntries = [];
const checkIns = [];
const cases = [];
const caseNotes = [];
const evidenceItems = [];
const auditLog = [];
const otpChallenges = new Map();
const sessions = new Map();
const rateBuckets = new Map();
const revokedAccounts = new Set();

function makeAudit(action, actor, target, details = {}) {
  const entry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    actor,
    target,
    details,
  };
  auditLog.unshift(entry);
  return entry;
}

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }

    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function hash(value) {
  return createHmac('sha256', jwtSecret || 'invalid-secret').update(value).digest('hex');
}

function encodeToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.${hash(`${header}.${body}`)}`;
}

function decodeToken(token) {
  const [header, body, signature] = String(token || '').split('.');
  if (!header || !body || !signature || !jwtSecret) return null;
  const expected = hash(`${header}.${body}`);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const active = (rateBuckets.get(key) || []).filter((timestamp) => timestamp > now - windowMs);
  if (active.length >= limit) return false;
  active.push(now);
  rateBuckets.set(key, active);
  return true;
}

function bearer(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

function authenticate(req, res, roles = []) {
  const payload = decodeToken(bearer(req));
  if (!payload || revokedAccounts.has(payload.sub) || !sessions.has(payload.jti)) {
    jsonResponse(res, 401, { error: 'Authentication required.' });
    return null;
  }
  if (roles.length && !roles.includes(payload.role)) {
    jsonResponse(res, 403, { error: 'You do not have permission for this action.' });
    return null;
  }
  return payload;
}

async function sendOtp(phone, otp) {
  if (allowDemoOtp) return { demo: true };
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID) {
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const response = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/Verifications`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: phone, Channel: 'sms' }),
    });
    if (!response.ok) throw new Error('OTP provider rejected the request.');
    return { provider: 'twilio' };
  }
  if (!process.env.MSG91_AUTH_KEY || !process.env.MSG91_TEMPLATE_ID) throw new Error('No production OTP provider is configured.');
  const response = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: { authkey: process.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: process.env.MSG91_TEMPLATE_ID, mobile: phone, otp }),
  });
  if (!response.ok) throw new Error('OTP provider rejected the request.');
  return { provider: 'msg91' };
}

function issueSession(subject, role, kind = 'access') {
  const jti = randomUUID();
  const token = encodeToken({ sub: subject, role, jti, kind, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + (kind === 'refresh' ? 30 * 24 * 3600 : 15 * 60) });
  sessions.set(jti, { subject, role, kind, createdAt: Date.now() });
  return { token, jti };
}

function ensureWorker(phone) {
  let worker = workers.get(phone);
  if (!worker) {
    worker = {
      id: randomUUID(),
      phone,
      role: 'worker',
      language: 'en',
      consent: {
        location: false,
        evidence: false,
        shareCase: false,
      },
      profile: {
        skills: [],
        origin: '',
        employer: '',
        worksite: '',
        wagePromise: null,
        payFrequency: 'monthly',
      },
      createdAt: new Date().toISOString(),
    };
    workers.set(phone, worker);
  }
  return worker;
}

function serveStaticFile(res, filePath) {
  const normalized = path.normalize(filePath);
  const resolvedPath = path.resolve(publicDir, normalized);

  if (!resolvedPath.startsWith(publicDir)) {
    jsonResponse(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.readFile(resolvedPath, (error, data) => {
    if (error) {
      jsonResponse(res, 404, { error: 'File not found.' });
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
    };

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function getWorkerDashboard(workerId) {
  const worker = Array.from(workers.values()).find((item) => item.id === workerId);
  if (!worker) {
    return null;
  }

  return {
    worker,
    wageEntries: wageEntries.filter((entry) => entry.workerId === workerId),
    checkIns: checkIns.filter((entry) => entry.workerId === workerId),
    cases: cases.filter((entry) => entry.workerId === workerId),
  };
}

function findCase(caseId) {
  return cases.find((item) => item.id === caseId);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    jsonResponse(res, 204, {});
    return;
  }

  if (pathname === '/' || pathname === '/index.html') {
    serveStaticFile(res, 'index.html');
    return;
  }

  if (pathname === '/styles.css' || pathname === '/app.js') {
    serveStaticFile(res, pathname.slice(1));
    return;
  }

  if (pathname === '/health') {
    jsonResponse(res, 200, {
      status: 'ok',
      service: 'pehchaan-migrate',
      timestamp: new Date().toISOString(),
      workers: workers.size,
      cases: cases.length,
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/request-otp') {
    try {
      const body = await parseBody(req);
      const phone = String(body.phone || '').trim();
      if (!phone) {
        jsonResponse(res, 400, { error: 'Phone number is required.' });
        return;
      }

      if (!checkRateLimit(`otp-request:${phone}`, 3, 15 * 60 * 1000)) {
        jsonResponse(res, 429, { error: 'Too many OTP requests. Please wait and try again.' });
        return;
      }
      const worker = ensureWorker(phone);
      const otp = allowDemoOtp ? '123456' : String(randomInt(100000, 1000000));
      await sendOtp(phone, otp);
      otpChallenges.set(phone, { otpHash: hash(otp), workerId: worker.id, expiresAt: Date.now() + otpTtlMs, attempts: 0 });
      makeAudit('otp_requested', 'system', worker.id, { phone, otpSent: true, demo: allowDemoOtp });

      jsonResponse(res, 200, {
        message: 'OTP sent.',
        workerId: worker.id,
        ...(allowDemoOtp ? { otpHint: otp, demoMode: true } : {}),
      });
      return;
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || 'Invalid request.' });
      return;
    }
  }

  if (req.method === 'POST' && pathname === '/api/auth/verify-otp') {
    try {
      const body = await parseBody(req);
      const phone = String(body.phone || '').trim();
      const otp = String(body.otp || '');
      if (!phone || !checkRateLimit(`otp-verify:${phone}`, 10, 15 * 60 * 1000)) {
        jsonResponse(res, 429, { error: 'Too many verification attempts. Please wait and try again.' });
        return;
      }
      const challenge = otpChallenges.get(phone);
      if (!challenge || challenge.expiresAt < Date.now() || challenge.attempts >= maxOtpAttempts || hash(otp) !== challenge.otpHash) {
        if (challenge) challenge.attempts += 1;
        jsonResponse(res, 401, { error: 'Invalid OTP.' });
        return;
      }

      const worker = ensureWorker(phone);
      otpChallenges.delete(phone);
      const access = issueSession(worker.id, 'worker');
      const refresh = issueSession(worker.id, 'worker', 'refresh');
      makeAudit('otp_verified', worker.id, worker.id, { phone });

      jsonResponse(res, 200, {
        accessToken: access.token,
        refreshToken: refresh.token,
        expiresIn: 900,
        user: {
          id: worker.id,
          phone,
          role: worker.role,
          language: worker.language,
        },
      });
      return;
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || 'Invalid request.' });
      return;
    }

  }

  if (req.method === 'POST' && pathname === '/api/auth/refresh') {
    const payload = authenticate(req, res);
    if (!payload || payload.kind !== 'refresh') return;
    sessions.delete(payload.jti);
    const access = issueSession(payload.sub, payload.role);
    const refresh = issueSession(payload.sub, payload.role, 'refresh');
    jsonResponse(res, 200, { accessToken: access.token, refreshToken: refresh.token, expiresIn: 900 });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const payload = authenticate(req, res);
    if (!payload) return;
    sessions.delete(payload.jti);
    const body = await parseBody(req);
    const refreshPayload = decodeToken(body.refreshToken);
    if (refreshPayload) sessions.delete(refreshPayload.jti);
    jsonResponse(res, 204, {});
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/ngo-login') {
    const body = await parseBody(req);
    if (!checkRateLimit(`ngo-login:${req.socket.remoteAddress}`, 10, 15 * 60 * 1000)) {
      jsonResponse(res, 429, { error: 'Too many login attempts. Please wait and try again.' });
      return;
    }
    if (body.email !== (process.env.NGO_DEMO_EMAIL || 'ngo@pehchaan.org') || body.password !== (process.env.NGO_DEMO_PASSWORD || 'demo')) {
      jsonResponse(res, 401, { error: 'Invalid organization credentials.' });
      return;
    }
    const access = issueSession(body.email, 'ngo_caseworker');
    const refresh = issueSession(body.email, 'ngo_caseworker', 'refresh');
    jsonResponse(res, 200, { accessToken: access.token, refreshToken: refresh.token, expiresIn: 900, user: { id: body.email, role: 'ngo_caseworker' } });
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/workers/')) {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    const workerId = pathname.split('/api/workers/')[1];
    if (actor.sub !== workerId) {
      jsonResponse(res, 403, { error: 'You can only access your own worker data.' });
      return;
    }
    if (!workerId) {
      jsonResponse(res, 400, { error: 'workerId is required.' });
      return;
    }

    const dashboard = getWorkerDashboard(workerId);
    if (!dashboard) {
      jsonResponse(res, 404, { error: 'Worker not found.' });
      return;
    }

    jsonResponse(res, 200, dashboard);
    return;
  }

  if (req.method === 'PATCH' && pathname === '/api/worker/profile') {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    try {
      const body = await parseBody(req);
      const workerId = String(body.workerId || '');
      if (actor.sub !== workerId) {
        jsonResponse(res, 403, { error: 'You can only update your own profile.' });
        return;
      }
      const worker = Array.from(workers.values()).find((item) => item.id === workerId);
      if (!worker) {
        jsonResponse(res, 404, { error: 'Worker not found.' });
        return;
      }

      worker.profile = { ...worker.profile, ...(body.profile || {}) };
      worker.language = body.language || worker.language;
      worker.consent = { ...worker.consent, ...(body.consent || {}) };
      makeAudit('worker_profile_updated', worker.id, worker.id, { profile: worker.profile });

      jsonResponse(res, 200, { worker });
      return;
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || 'Invalid request.' });
      return;
    }
  }

  if (req.method === 'POST' && pathname === '/api/wage-entries') {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    try {
      const body = await parseBody(req);
      if (actor.sub !== String(body.workerId || '')) {
        jsonResponse(res, 403, { error: 'You can only add your own wage entries.' });
        return;
      }
      const wageEntry = {
        id: randomUUID(),
        workerId: String(body.workerId || ''),
        date: body.date || new Date().toISOString(),
        type: body.type || 'promised',
        amount: Number(body.amount || 0),
        deductions: Number(body.deductions || 0),
        overtime: Number(body.overtime || 0),
        proofFileId: body.proofFileId || null,
        createdAt: new Date().toISOString(),
      };

      if (!wageEntry.workerId) {
        jsonResponse(res, 400, { error: 'workerId is required.' });
        return;
      }

      wageEntries.push(wageEntry);
      makeAudit('wage_entry_created', wageEntry.workerId, wageEntry.id, wageEntry);
      jsonResponse(res, 201, { wageEntry });
      return;
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || 'Invalid request.' });
      return;
    }
  }

  if (req.method === 'POST' && pathname === '/api/check-ins') {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    try {
      const body = await parseBody(req);
      if (actor.sub !== String(body.workerId || '')) {
        jsonResponse(res, 403, { error: 'You can only submit your own check-in.' });
        return;
      }
      const checkIn = {
        id: randomUUID(),
        workerId: String(body.workerId || ''),
        status: body.status || 'safe',
        hazard: body.hazard || null,
        locationConsent: Boolean(body.locationConsent),
        location: body.location || null,
        notes: body.notes || '',
        createdAt: new Date().toISOString(),
      };

      if (!checkIn.workerId) {
        jsonResponse(res, 400, { error: 'workerId is required.' });
        return;
      }

      checkIns.push(checkIn);
      makeAudit('check_in_created', checkIn.workerId, checkIn.id, checkIn);
      jsonResponse(res, 201, { checkIn });
      return;
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || 'Invalid request.' });
      return;
    }
  }

  if (req.method === 'POST' && pathname === '/api/cases') {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    try {
      const body = await parseBody(req);
      if (actor.sub !== String(body.workerId || '')) {
        jsonResponse(res, 403, { error: 'You can only create a case for yourself.' });
        return;
      }
      const newCase = {
        id: `case-${Date.now()}`,
        workerId: String(body.workerId || ''),
        type: body.type || 'wage_theft',
        priority: body.priority || 'medium',
        status: 'new',
        summary: body.summary || '',
        owner: body.owner || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!newCase.workerId) {
        jsonResponse(res, 400, { error: 'workerId is required.' });
        return;
      }

      cases.push(newCase);
      makeAudit('case_created', newCase.workerId, newCase.id, { type: newCase.type });
      jsonResponse(res, 201, { case: newCase });
      return;
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || 'Invalid request.' });
      return;
    }
  }

  if (req.method === 'POST' && pathname.startsWith('/api/cases/') && pathname.endsWith('/evidence')) {
    if (!authenticate(req, res, ['ngo_caseworker', 'ngo_admin'])) return;
    try {
      const caseId = pathname.split('/')[3];
      if (!findCase(caseId)) {
        jsonResponse(res, 404, { error: 'Case not found.' });
        return;
      }

      const body = await parseBody(req);
      const evidence = {
        id: randomUUID(),
        caseId,
        type: body.type || 'document',
        fileName: body.fileName || 'evidence',
        storageKey: body.storageKey || `private/${randomUUID()}`,
        checksum: body.checksum || null,
        createdAt: new Date().toISOString(),
      };
      evidenceItems.push(evidence);
      makeAudit('evidence_uploaded', 'caseworker', caseId, { evidence });
      jsonResponse(res, 201, { evidence });
      return;
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || 'Invalid request.' });
      return;
    }
  }

  if (req.method === 'GET' && pathname === '/api/ngo/cases') {
    if (!authenticate(req, res, ['ngo_caseworker', 'ngo_admin'])) return;
    jsonResponse(res, 200, { cases, total: cases.length, auditLog: auditLog.slice(0, 5) });
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/ngo/cases/') && pathname.split('/').length === 5) {
    if (!authenticate(req, res, ['ngo_caseworker', 'ngo_admin'])) return;
    const caseId = pathname.split('/')[4];
    const targetCase = findCase(caseId);
    if (!targetCase) {
      jsonResponse(res, 404, { error: 'Case not found.' });
      return;
    }

    jsonResponse(res, 200, {
      case: targetCase,
      notes: caseNotes.filter((note) => note.caseId === caseId),
      evidence: evidenceItems.filter((item) => item.caseId === caseId),
      auditLog: auditLog.filter((entry) => entry.target === caseId),
    });
    return;
  }

  if (req.method === 'POST' && pathname.startsWith('/api/ngo/cases/') && pathname.endsWith('/notes')) {
    const actor = authenticate(req, res, ['ngo_caseworker', 'ngo_admin']);
    if (!actor) return;
    try {
      const caseId = pathname.split('/')[4];
      if (!findCase(caseId)) {
        jsonResponse(res, 404, { error: 'Case not found.' });
        return;
      }

      const body = await parseBody(req);
      const noteText = String(body.text || '').trim();
      if (!noteText) {
        jsonResponse(res, 400, { error: 'Note text is required.' });
        return;
      }

      const note = {
        id: randomUUID(),
        caseId,
        author: String(body.author || actor.sub),
        text: noteText,
        createdAt: new Date().toISOString(),
      };
      caseNotes.push(note);
      makeAudit('case_note_created', note.author, caseId, { noteId: note.id });
      jsonResponse(res, 201, { note });
      return;
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || 'Invalid request.' });
      return;
    }
  }

  if (req.method === 'GET' && pathname === '/api/ngo/audit-log') {
    if (!authenticate(req, res, ['ngo_caseworker', 'ngo_admin'])) return;
    jsonResponse(res, 200, { entries: auditLog, total: auditLog.length });
    return;
  }

  if (req.method === 'PATCH' && pathname.startsWith('/api/ngo/cases/')) {
    const actor = authenticate(req, res, ['ngo_caseworker', 'ngo_admin']);
    if (!actor) return;
    try {
      const caseId = pathname.split('/')[3];
      const body = await parseBody(req);
      const targetCase = findCase(caseId);
      if (!targetCase) {
        jsonResponse(res, 404, { error: 'Case not found.' });
        return;
      }

      targetCase.status = body.status || targetCase.status;
      targetCase.owner = body.owner || targetCase.owner;
      targetCase.priority = body.priority || targetCase.priority;
      targetCase.updatedAt = new Date().toISOString();
      makeAudit('case_updated', actor.sub, caseId, { changes: body });

      jsonResponse(res, 200, { case: targetCase });
      return;
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || 'Invalid request.' });
      return;
    }
  }

  if (req.method === 'POST' && pathname.startsWith('/api/cases/') && pathname.endsWith('/alerts')) {
    if (!authenticate(req, res, ['ngo_caseworker', 'ngo_admin'])) return;
    try {
      const caseId = pathname.split('/')[3];
      const body = await parseBody(req);
      const alert = {
        id: randomUUID(),
        caseId,
        channel: body.channel || 'sms',
        recipient: body.recipient || 'ngo@demo.local',
        status: 'pending',
        acknowledgedAt: null,
        createdAt: new Date().toISOString(),
      };
      makeAudit('alert_created', 'system', caseId, alert);
      jsonResponse(res, 201, { alert });
      return;
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || 'Invalid request.' });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/admin/revoke-account') {
      const actor = authenticate(req, res, ['ngo_admin']);
      if (!actor) return;
      const body = await parseBody(req);
      const accountId = String(body.accountId || '');
      if (!accountId) {
        jsonResponse(res, 400, { error: 'accountId is required.' });
        return;
      }
      revokedAccounts.add(accountId);
      for (const [jti, session] of sessions) {
        if (session.subject === accountId) sessions.delete(jti);
      }
      makeAudit('account_revoked', actor.sub, accountId);
      jsonResponse(res, 200, { revoked: true, accountId });
      return;
    }
  }

  jsonResponse(res, 404, {
    error: 'Route not found.',
    available: [
      'GET /',
      'GET /health',
      'POST /api/auth/request-otp',
      'POST /api/auth/verify-otp',
      'GET /api/workers/:id',
      'PATCH /api/worker/profile',
      'POST /api/wage-entries',
      'POST /api/check-ins',
      'POST /api/cases',
      'POST /api/cases/:id/evidence',
      'GET /api/ngo/cases',
      'GET /api/ngo/cases/:id',
      'POST /api/ngo/cases/:id/notes',
      'GET /api/ngo/audit-log',
      'PATCH /api/ngo/cases/:id',
      'POST /api/cases/:id/alerts',
      'POST /api/auth/refresh',
      'POST /api/auth/logout',
      'POST /api/auth/ngo-login',
      'POST /api/admin/revoke-account',
    ],
  });
});

server.listen(PORT, () => {
  console.log(`Pehchaan Migrate worker MVP listening on http://localhost:${PORT}`);
});
