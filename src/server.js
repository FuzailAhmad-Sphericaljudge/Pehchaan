import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT || 5000);
const publicDir = path.resolve(process.cwd(), 'public');

const workers = new Map();
const wageEntries = [];
const checkIns = [];
const cases = [];
const caseNotes = [];
const evidenceItems = [];
const auditLog = [];

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

      const worker = ensureWorker(phone);
      const otp = '123456';
      makeAudit('otp_requested', 'system', worker.id, { phone, otpSent: true });

      jsonResponse(res, 200, {
        message: 'OTP sent.',
        workerId: worker.id,
        otpHint: otp,
        demoMode: true,
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
      if (!phone || otp !== '123456') {
        jsonResponse(res, 401, { error: 'Invalid OTP.' });
        return;
      }

      const worker = ensureWorker(phone);
      const token = `pehchaan-demo-token-${worker.id}`;
      makeAudit('otp_verified', worker.id, worker.id, { phone });

      jsonResponse(res, 200, {
        accessToken: token,
        refreshToken: `pehchaan-demo-refresh-${worker.id}`,
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

  if (req.method === 'GET' && pathname.startsWith('/api/workers/')) {
    const workerId = pathname.split('/api/workers/')[1];
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
    try {
      const body = await parseBody(req);
      const workerId = String(body.workerId || '');
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
    try {
      const body = await parseBody(req);
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
    try {
      const body = await parseBody(req);
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
    try {
      const body = await parseBody(req);
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
    jsonResponse(res, 200, { cases, total: cases.length, auditLog: auditLog.slice(0, 5) });
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/ngo/cases/') && pathname.split('/').length === 5) {
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
        author: String(body.author || 'caseworker'),
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
    jsonResponse(res, 200, { entries: auditLog, total: auditLog.length });
    return;
  }

  if (req.method === 'PATCH' && pathname.startsWith('/api/ngo/cases/')) {
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
      makeAudit('case_updated', 'caseworker', caseId, { changes: body });

      jsonResponse(res, 200, { case: targetCase });
      return;
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || 'Invalid request.' });
      return;
    }
  }

  if (req.method === 'POST' && pathname.startsWith('/api/cases/') && pathname.endsWith('/alerts')) {
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
    ],
  });
});

server.listen(PORT, () => {
  console.log(`Pehchaan Migrate worker MVP listening on http://localhost:${PORT}`);
});
