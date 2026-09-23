import http from 'node:http';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { closeDatabase, databaseConfigured, loadState, saveState } from './db.js';

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
const alerts = [];
const employerWageRecords = [];
const employerInterest = [];
const worksites = new Map();
const legalDocuments = new Map();
const minimumWages = new Map();
const welfareSchemes = new Map();
const workRelationships = new Map();
const trustedContacts = new Map();
const platformApplications = new Map();
const accountRecovery = new Map();
const notifications = [];
const notificationPreferences = new Map();
const pushSubscriptions = new Map();
const notificationQueue = [];
let notificationTimer = null;
const fraudReports = [];
const fraudScreens = [];

const legalDisclaimer = 'This document was prepared with Pehchaan to help organize information. It is not a substitute for legal advice.';
const whatsappSessions = new Map();
const smsSessions = new Map();
const alertAckWindowMs = Number(process.env.ALERT_ACK_WINDOW_MINUTES || 15) * 60 * 1000;
const emergencyDisclaimer = 'Pehchaan does not replace emergency services, police, courts, or labour departments. It helps workers and trusted organizations organize information and access support more effectively.';
const otpChallenges = new Map();
const sessions = new Map();
const rateBuckets = new Map();
const revokedAccounts = new Set();
let stateLoaded = false;
const evidenceBucket = process.env.SUPABASE_EVIDENCE_BUCKET || 'pehchaan-evidence';
const allowedEvidenceTypes = new Map([
  ['image/jpeg', 'jpg'], ['image/png', 'png'], ['application/pdf', 'pdf'],
]);
const maxEvidenceBytes = 10 * 1024 * 1024;
const maxEvidencePerCase = 10;
const maxTrustedContacts = 5;

function persist() {
  if (!stateLoaded || !databaseConfigured()) return;
  void saveState({ workers, wageEntries, checkIns, cases, caseNotes, evidenceItems, alerts, auditLog, otpChallenges, sessions, revokedAccounts, worksites: Array.from(worksites.values()), legalDocuments: Array.from(legalDocuments.values()), minimumWages: Array.from(minimumWages.values()), welfareSchemes: Array.from(welfareSchemes.values()), workRelationships: Array.from(workRelationships.values()), trustedContacts: Array.from(trustedContacts.values()), platformApplications: Array.from(platformApplications.values()), accountRecovery: Array.from(accountRecovery.values()), notifications: notifications.slice(0, 2000), notificationPreferences: Array.from(notificationPreferences.values()), pushSubscriptions: Array.from(pushSubscriptions.values()), fraudReports: fraudReports.slice(0, 2000) })
    .catch((error) => console.error('Database persistence failed:', error.message));
}

// ---- Phase 32: Notifications Center ---------------------------------------
// A general, best-effort notification system that is deliberately separate
// from (and lower priority than) the Phase 11 safety-escalation channel.
// Safety alerts never enter this queue: createSafetyAlert keeps its own direct
// path, so routine notification processing can never delay an escalation.

const notificationTypes = ['case_status_changed', 'case_note_added', 'wage_flagged', 'scheme_matched', 'case_assigned', 'case_reopened', 'alert_escalated'];

function defaultNotificationPreferences() {
  return { caseUpdates: true, caseNotes: true, wageFlags: true, schemeMatches: true };
}

function notificationPreferencesFor(workerId) {
  if (!notificationPreferences.has(workerId)) notificationPreferences.set(workerId, defaultNotificationPreferences());
  return notificationPreferences.get(workerId);
}

function serializeNotification(item) {
  return {
    id: item.id,
    caseId: item.caseId || null,
    type: item.type,
    priority: item.priority,
    title: item.title,
    body: item.body,
    meta: item.meta || {},
    readAt: item.readAt || null,
    createdAt: item.createdAt,
  };
}

// Records one notification. Returns null when the worker opted out of the
// non-urgent type. Urgent (safety) events bypass preferences and this queue.
function createNotification({ audienceRole = 'worker', workerId = null, caseId = null, type, title, body, meta = {}, urgent = false }) {
  if (!notificationTypes.includes(type)) return null;
  if (audienceRole === 'worker' && workerId) {
    const prefs = notificationPreferencesFor(workerId);
    const allowed = {
      case_status_changed: prefs.caseUpdates,
      case_note_added: prefs.caseNotes,
      wage_flagged: prefs.wageFlags,
      scheme_matched: prefs.schemeMatches,
      case_assigned: true,
      case_reopened: true,
      alert_escalated: true,
    };
    if (!allowed[type]) return null;
  }
  const notification = {
    id: randomUUID(),
    audienceRole,
    workerId,
    caseId,
    type,
    priority: urgent ? 'high' : 'normal',
    title,
    body,
    meta,
    readAt: null,
    deliveredPushAt: null,
    createdAt: new Date().toISOString(),
  };
  notifications.unshift(notification);
  if (notifications.length > 5000) notifications.length = 5000;
  notificationQueue.push(notification.id);
  scheduleNotificationFlush();
  persist();
  return notification;
}

// NGO-staff notifications are work items for the whole caseworker pool; they
// go through the same Phase 32 queue (safety alerts keep their direct path).
function notifyNgoCaseworkers({ caseId = null, type, title, body, meta = {} }) {
  return createNotification({ audienceRole: 'ngo', workerId: null, caseId, type, title, body, meta });
}

function scheduleNotificationFlush() {
  if (notificationTimer) return;
  notificationTimer = setTimeout(() => {
    notificationTimer = null;
    flushNotificationQueue().catch((error) => console.error('Notification flush failed:', error.message));
  }, 5 * 1000);
}

async function flushNotificationQueue() {
  const batch = notificationQueue.splice(0, notificationQueue.length);
  if (!batch.length) return;
  for (const id of batch) {
    const notification = notifications.find((item) => item.id === id);
    if (!notification || notification.deliveredPushAt) continue;
    try {
      const sent = await sendWebPush(notification.audienceRole, notification.workerId, {
        id: notification.id,
        type: notification.type,
        priority: notification.priority,
        title: notification.title,
        body: notification.body,
        caseId: notification.caseId,
      });
      if (sent > 0) {
        notification.deliveredPushAt = new Date().toISOString();
        persist();
      }
    } catch (error) {
      console.error('Push delivery failed:', error.message);
    }
  }
}

function pushSubscriptionAudience(audienceRole, workerId) {
  return Array.from(pushSubscriptions.values())
    .filter((item) => item.audienceRole === audienceRole && (audienceRole === 'ngo' || item.workerId === workerId));
}

// Web-push sender. Web Push requires VAPID-signed requests; the built-in fetch
// cannot sign them, so without a provider configured this records the intent
// (delivered_push_at stays null) and the in-app center remains the channel.
// Set PUSH_PROVIDER=vapid + the VAPID keys to enable real browser delivery.
async function sendWebPush(audienceRole, workerId, payload) {
  const subscriptions = pushSubscriptionAudience(audienceRole, workerId);
  if (!subscriptions.length) return 0;
  if (process.env.PUSH_PROVIDER !== 'vapid' || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    return 0;
  }
  return sendVapidPush(subscriptions, payload);
}

async function sendVapidPush(subscriptions, payload) {
  let sent = 0;
  for (const subscription of subscriptions) {
    try {
      const response = await fetch(process.env.PUSH_API_URL || 'http://localhost:9090/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          payload,
          vapid: { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY, subject: process.env.VAPID_SUBJECT },
        }),
      });
      if (response.status === 404 || response.status === 410) {
        pushSubscriptions.delete(subscription.id);
        persist();
        continue;
      }
      if (response.ok) {
        sent += 1;
      }
    } catch {
      // Provider unreachable: leave delivered_push_at null so the flush loop retries later.
    }
  }
  return sent;
}

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
  persist();
  return entry;
}

function buildAiTriage(summary, { immediateDanger = false, happeningNow = false, type = 'other' } = {}) {
  const text = String(summary || '').toLowerCase();
  const signals = [];
  let score = 0;
  if (immediateDanger) { score += 60; signals.push('worker_selected_immediate_danger'); }
  if (happeningNow) { score += 30; signals.push('worker_selected_happening_now'); }
  const urgentWords = ['danger', 'threat', 'injury', 'hurt', 'violence', 'abuse', 'fire', 'trapped', 'खतरा', 'मार', 'चोट', 'आग'];
  const reviewWords = ['unpaid', 'withheld', 'unsafe', 'harassment', 'deduction', 'wage', 'मजदूरी', 'पैसे', 'उत्पीड़न', 'असुरक्षित'];
  const urgentHits = urgentWords.filter((word) => text.includes(word));
  const reviewHits = reviewWords.filter((word) => text.includes(word));
  if (urgentHits.length) { score += Math.min(20, urgentHits.length * 10); signals.push(`urgent_terms:${urgentHits.join(',')}`); }
  if (reviewHits.length) { score += Math.min(15, reviewHits.length * 5); signals.push(`review_terms:${reviewHits.join(',')}`); }
  if (type === 'unsafe_site' || type === 'harassment') { score += 10; signals.push(`case_type:${type}`); }
  if (type === 'debt_bondage') { score += 45; signals.push('case_type:debt_bondage'); }
  const category = score >= 60 ? 'Urgent' : score >= 20 ? 'Needs review' : 'Routine';
  return { category, score: Math.min(score, 100), signals, generatedBy: 'rules-v1', generatedAt: new Date().toISOString(), humanDecision: null };
}

function buildAutoSummary(targetCase) {
  const text = String(targetCase.summary || '').trim().replace(/\s+/g, ' ');
  if (text.length <= 240) return text;
  return `${text.slice(0, 237).replace(/\s+\S*$/, '')}...`;
}

function employerPatternSignals() {
  const groups = new Map();
  for (const item of cases) {
    const worker = Array.from(workers.values()).find((candidate) => candidate.id === item.workerId);
    const employer = String(worker?.profile?.employer || worker?.profile?.worksite || '').trim().toLowerCase();
    if (!employer) continue;
    const existing = groups.get(employer) || { employer, cases: [], workers: new Set() };
    existing.cases.push(item.id);
    existing.workers.add(item.workerId);
    groups.set(employer, existing);
  }

  function legalDocumentContent(targetCase, language, type, edits = {}) {
    const worker = Array.from(workers.values()).find((item) => item.id === targetCase.workerId);
    const profile = worker?.profile || {};
    const isWage = type === 'wage_notice';
    const title = isWage ? (language === 'hi' ? 'मजदूरी वसूली नोटिस' : 'Wage Recovery Notice') : (language === 'hi' ? 'सुरक्षा घटना रिपोर्ट' : 'Safety Incident Report');
    const plain = isWage
      ? (language === 'hi' ? 'यह दस्तावेज़ बकाया मजदूरी और भुगतान के अंतर को स्पष्ट करने के लिए तैयार किया गया है।' : 'This document records the difference between promised and received wages for review and recovery.')
      : (language === 'hi' ? 'यह रिपोर्ट कार्यस्थल की सुरक्षा घटना और सहायता के लिए उपलब्ध जानकारी को व्यवस्थित करती है।' : 'This report organizes the available information about a workplace safety incident for review and support.');
    return {
      title: edits.title || title,
      plainLanguage: edits.plainLanguage || plain,
      date: new Date().toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN'),
      workerPhone: worker?.phone || '',
      employer: profile.employer || '',
      worksite: profile.worksite || '',
      summary: edits.summary || targetCase.summary,
      promisedAmount: profile.wagePromise || '',
      receivedAmount: '',
      complaintDate: new Date(targetCase.createdAt).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN'),
      evidenceReferences: evidenceItems.filter((item) => item.caseId === targetCase.id).map((item) => item.fileName),
      disclaimer: legalDisclaimer,
      documentType: type,
    };
  }

  function createPdf(documentData, language) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const document = new PDFDocument({ margin: 54 });
      document.on('data', (chunk) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
      const font = language === 'hi' && fs.existsSync('C:\\Windows\\Fonts\\Nirmala.ttf') ? 'C:\\Windows\\Fonts\\Nirmala.ttf' : undefined;
      if (font) document.font(font);
      document.fontSize(18).text(documentData.title, { align: 'center' });
      document.moveDown().fontSize(10).text(`Prepared: ${documentData.date}`);
      document.moveDown().fontSize(12).text(documentData.plainLanguage);
      document.moveDown().fontSize(12).text(`Worker phone: ${documentData.workerPhone}`);
      document.text(`Employer: ${documentData.employer || 'Not provided'}`);
      document.text(`Worksite: ${documentData.worksite || 'Not provided'}`);
      document.text(`Complaint date: ${documentData.complaintDate}`);
      if (documentData.promisedAmount) document.text(`Promised amount: ${documentData.promisedAmount}`);
      if (documentData.receivedAmount) document.text(`Received amount: ${documentData.receivedAmount}`);
      document.moveDown().fontSize(12).text('Details / विवरण');
      document.moveDown(0.5).fontSize(11).text(documentData.summary || 'No additional details provided.');
      if (documentData.evidenceReferences.length) document.moveDown().text(`Evidence references: ${documentData.evidenceReferences.join(', ')}`);
      document.moveDown(2).fontSize(9).text(documentData.disclaimer);
      document.end();
    });
  }
  return Array.from(groups.values())
    .filter((item) => item.workers.size >= 2)
    .map((item) => ({ employer: item.employer, complaintCount: item.cases.length, independentWorkers: item.workers.size, caseIds: item.cases, signal: 'Multiple independent workers reference the same employer/site. Investigate; do not auto-penalize.' }));
}

function whatsappPhone(value) {
  return String(value || '').replace(/^whatsapp:/, '').replace(/[^\d+]/g, '');
}

function xmlEscape(value) {
  return String(value).replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character]));
}

function whatsappMenu(language = 'hi') {
  const menus = {
    en: 'Pehchaan menu:\\nReply with a number:\\n1. Add wage received\\n2. Safety check-in\\n3. Report a problem\\n4. Check case status\\n5. Open full app\\nReply LANG HI, LANG BN, LANG TA, or LANG TE to change language.',
    bn: 'পরিচয় মেনু:\\nএকটি নম্বর দিয়ে উত্তর দিন:\\n1. পাওয়া মজুরি যোগ করুন\\n2. নিরাপত্তা পরীক্ষা\\n3. সমস্যা জানান\\n4. মামলার অবস্থা দেখুন\\n5. সম্পূর্ণ অ্যাপ খুলুন',
    ta: 'Pehchaan மெனு:\\nஎண்ணை அனுப்பவும்:\\n1. பெற்ற ஊதியத்தைச் சேர்க்கவும்\\n2. பாதுகாப்பு சோதனை\\n3. சிக்கலை தெரிவிக்கவும்\\n4. வழக்கு நிலை\\n5. முழு பயன்பாட்டைத் திறக்கவும்',
    te: 'Pehchaan మెను:\\nఒక సంఖ్యతో ప్రత్యుత్తరం ఇవ్వండి:\\n1. అందుకున్న వేతనం జోడించండి\\n2. భద్రత తనిఖీ\\n3. సమస్యను నివేదించండి\\n4. కేసు స్థితి\\n5. పూర్తి యాప్ తెరవండి',
    hi: 'पहचान मेन्यू:\\nनंबर से जवाब दें:\\n1. मिली मजदूरी जोड़ें\\n2. सुरक्षा जांच\\n3. समस्या बताएं\\n4. मामले की स्थिति\\n5. पूरा ऐप खोलें\\nभाषा बदलने के लिए LANG EN, LANG BN, LANG TA या LANG TE भेजें।',
  };
  return menus[language] || menus.en;
}

function whatsappText(language, key) {
  const text = {
    linked: { en: 'Your Pehchaan account is linked.', hi: 'आपका पहचान खाता जुड़ गया है।', bn: 'আপনার পরিচয় অ্যাকাউন্ট যুক্ত হয়েছে।', ta: 'உங்கள் Pehchaan கணக்கு இணைக்கப்பட்டது.', te: 'మీ Pehchaan ఖాతా లింక్ చేయబడింది.' },
    welcome: { en: 'Welcome to Pehchaan. Reply REGISTER to link this WhatsApp number, or open the app for secure OTP linking.', hi: 'पहचान में आपका स्वागत है। यह WhatsApp नंबर जोड़ने के लिए REGISTER भेजें, या सुरक्षित OTP linking के लिए ऐप खोलें।', bn: 'পরিচয়ে স্বাগতম। এই WhatsApp নম্বর যুক্ত করতে REGISTER পাঠান, অথবা নিরাপদ OTP linking-এর জন্য অ্যাপ খুলুন।', ta: 'Pehchaan-க்கு வரவேற்கிறோம். இந்த WhatsApp எண்ணை இணைக்க REGISTER அனுப்பவும் அல்லது பாதுகாப்பான OTP linking-க்கு பயன்பாட்டைத் திறக்கவும்.', te: 'Pehchaan కు స్వాగతం. ఈ WhatsApp నంబర్‌ను లింక్ చేయడానికి REGISTER పంపండి లేదా సురక్షిత OTP linking కోసం యాప్ తెరవండి.' },
  };
  return text[key][language] || text[key].en;
}

function smsMenu(language = 'hi') {
  return language === 'en'
    ? 'Pehchaan: Reply 1 SAFE, 2 HELP, 3 PAY, 4 COMPLAINT, 5 STATUS. Reply HI or EN.'
    : 'पहचान: 1 सुरक्षित, 2 मदद, 3 मजदूरी, 4 शिकायत, 5 स्थिति। HI या EN भेजें।';
}

function smsReply(res, message) {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

async function sendSms(to, message) {
  if (process.env.SMS_PROVIDER !== 'twilio') return { provider: 'stub' };
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.SMS_FROM) throw new Error('SMS provider is not configured.');
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: process.env.SMS_FROM, To: to, Body: message }),
  });
  if (!response.ok) throw new Error('SMS provider rejected the message.');
  return { provider: 'twilio' };
}

async function handleSmsMessage(req, res) {
  const body = await parseBody(req);
  const phone = whatsappPhone(body.From || body.from || body.phone || body.Mobile);
  const text = String(body.Body || body.body || body.text || '').trim();
  if (!phone) { smsReply(res, 'Phone number missing.'); return; }
  let session = smsSessions.get(phone) || { phone, workerId: null, language: 'hi', state: 'menu', data: {} };
  const upper = text.toUpperCase();
  if (upper === 'HI' || upper === 'HINDI') session.language = 'hi';
  if (upper === 'EN' || upper === 'ENGLISH') session.language = 'en';
  const worker = ensureWorker(phone);
  session.workerId = worker.id;
  if (upper === 'SAFE' || text === '1') {
    const checkIn = { id: randomUUID(), workerId: worker.id, status: 'safe', hazard: null, locationConsent: false, location: null, notes: 'SMS check-in', createdAt: new Date().toISOString(), source: 'sms' };
    checkIns.push(checkIn); makeAudit('check_in_created', worker.id, checkIn.id, { source: 'sms' }); session.state = 'menu'; smsSessions.set(phone, session); smsReply(res, session.language === 'en' ? `Safe check-in recorded.\\n${smsMenu('en')}` : `सुरक्षित जांच दर्ज।\\n${smsMenu('hi')}`); return;
  }
  if (upper === 'HELP' || text === '2') {
    const checkIn = { id: randomUUID(), workerId: worker.id, status: 'unsafe', hazard: 'SMS distress', locationConsent: false, location: null, notes: 'SMS help request', createdAt: new Date().toISOString(), source: 'sms' };
    checkIns.push(checkIn);     createSafetyAlert({ workerId: worker.id, kind: 'emergency_checkin', location: null, locationConsent: false, details: { source: 'sms' } }); makeAudit('check_in_created', worker.id, checkIn.id, { source: 'sms' }); session.state = 'menu'; smsSessions.set(phone, session); smsReply(res, session.language === 'en' ? `Help alert sent. Call 112 if in immediate danger.\\n${smsMenu('en')}` : `मदद का अलर्ट भेजा गया। तत्काल खतरे में 112 कॉल करें।\\n${smsMenu('hi')}`); return;
  }
  if (upper === 'PAY' || text === '3') { session.state = 'wage_amount'; smsSessions.set(phone, session); smsReply(res, session.language === 'en' ? 'Reply amount received, e.g. PAY 500.' : 'मिली रकम भेजें, जैसे PAY 500।'); return; }
  if (session.state === 'wage_amount' || upper.startsWith('PAY ')) {
    const amount = Number(text.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) { smsReply(res, 'Reply amount, e.g. PAY 500.'); return; }
    const entry = { id: randomUUID(), workerId: worker.id, date: new Date().toISOString(), type: 'received', amount, deductions: 0, overtime: 0, proofFileId: null, createdAt: new Date().toISOString(), source: 'sms' };
    wageEntries.push(entry); makeAudit('wage_entry_created', worker.id, entry.id, { source: 'sms' }); session.state = 'menu'; smsSessions.set(phone, session); smsReply(res, `₹${amount} wage saved.\\n${smsMenu(session.language)}`); return;
  }
  if (upper === 'COMPLAINT' || text === '4') { session.state = 'complaint'; smsSessions.set(phone, session); smsReply(res, session.language === 'en' ? 'Reply COMPLAINT followed by a short description.' : 'COMPLAINT के बाद छोटी समस्या लिखकर भेजें।'); return; }
  if (session.state === 'complaint' || upper.startsWith('COMPLAINT ')) {
    const summary = text.replace(/^COMPLAINT\s*/i, '').trim();
    if (!summary) { smsReply(res, 'Reply COMPLAINT followed by your problem.'); return; }
    const newCase = { id: `case-${Date.now()}`, workerId: worker.id, type: 'other', priority: 'medium', status: 'new', summary, owner: null, immediateDanger: false, happeningNow: false, aiTriage: buildAiTriage(summary), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), source: 'sms' };
    cases.push(newCase); applyFraudScreening(newCase, { ip: clientIp(req) }); recordFraudScreenSeen(clientIp(req), summary); if (newCase.fraudReview) makeAudit('case_flagged_for_fraud_review', 'system:fraud-screening', newCase.id, { signals: newCase.fraudReview.signals, source: 'sms' }); makeAudit('case_created', worker.id, newCase.id, { source: 'sms' }); makeAudit('ai_triage_suggested', 'system:ai-triage', newCase.id, newCase.aiTriage); session.state = 'menu'; smsSessions.set(phone, session); smsReply(res, `Case ${newCase.id} created. Reply 5 for status.\\n${smsMenu(session.language)}`); return;
  }
  if (upper === 'STATUS' || text === '5') {
    const ownCases = cases.filter((item) => item.workerId === worker.id).slice(-3);
    smsSessions.set(phone, { ...session, state: 'menu' });
    smsReply(res, ownCases.length ? ownCases.map((item) => `${item.id}: ${item.status}`).join('\\n') : 'No cases found.');
    return;
  }
  smsSessions.set(phone, session); smsReply(res, smsMenu(session.language));
}

async function handleWhatsAppMessage(req, res) {
  const body = await parseBody(req);
  const phone = whatsappPhone(body.From || body.from || body.phone);
  const text = String(body.Body || body.body || '').trim();
  if (!phone) { whatsappResponse(res, 'Phone number could not be identified.'); return; }
  let session = whatsappSessions.get(phone) || { phone, workerId: null, language: 'hi', state: 'menu', data: {} };
  const upper = text.toUpperCase();
  if (upper === 'LANG EN' || upper === 'ENGLISH') session.language = 'en';
  if (upper === 'LANG HI' || upper === 'HINDI') session.language = 'hi';
  if (upper === 'LANG BN' || upper === 'BENGALI') session.language = 'bn';
  if (upper === 'LANG TA' || upper === 'TAMIL') session.language = 'ta';
  if (upper === 'LANG TE' || upper === 'TELUGU') session.language = 'te';
  const language = session.language;
  if (upper === 'REGISTER' || upper === 'LINK') {
    const worker = ensureWorker(phone);
    session.workerId = worker.id; session.state = 'menu';
    makeAudit('whatsapp_worker_linked', worker.id, worker.id, { phone });
    whatsappSessions.set(phone, session);
    whatsappResponse(res, `${whatsappText(language, 'linked')}\\n\\n${whatsappMenu(language)}`);
    return;
  }
  if (!session.workerId) {
    whatsappSessions.set(phone, session);
    whatsappResponse(res, whatsappText(language, 'welcome'));
    return;
  }
  const worker = Array.from(workers.values()).find((item) => item.id === session.workerId);
  if (upper === 'MENU' || upper === 'START' || upper === 'LANG EN' || upper === 'LANG HI') { session.state = 'menu'; whatsappSessions.set(phone, session); whatsappResponse(res, whatsappMenu(language)); return; }
  if (session.state === 'wage_amount') {
    const amount = Number(text.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) { whatsappResponse(res, language === 'en' ? 'Please reply with the amount, for example 500.' : 'कृपया रकम भेजें, जैसे 500।'); return; }
    const entry = { id: randomUUID(), workerId: worker.id, date: new Date().toISOString(), type: 'received', amount, deductions: 0, overtime: 0, proofFileId: null, createdAt: new Date().toISOString(), source: 'whatsapp' };
    wageEntries.push(entry); session.state = 'menu'; makeAudit('wage_entry_created', worker.id, entry.id, { source: 'whatsapp' }); whatsappSessions.set(phone, session);
    whatsappResponse(res, language === 'en' ? `₹${amount} wage entry saved.\\n\\n${whatsappMenu(language)}` : `₹${amount} की मजदूरी दर्ज हो गई।\\n\\n${whatsappMenu(language)}`); return;
  }
  if (session.state === 'complaint_detail') {
    const aiTriage = buildAiTriage(text, { type: 'other' });
    const newCase = { id: `case-${Date.now()}`, workerId: worker.id, type: 'other', priority: 'medium', status: 'new', summary: text, owner: null, immediateDanger: false, happeningNow: false, aiTriage, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), source: 'whatsapp' };
    cases.push(newCase); applyFraudScreening(newCase, { ip: clientIp(req) }); recordFraudScreenSeen(clientIp(req), text); if (newCase.fraudReview) makeAudit('case_flagged_for_fraud_review', 'system:fraud-screening', newCase.id, { signals: newCase.fraudReview.signals, source: 'whatsapp' }); session.state = 'menu'; makeAudit('case_created', worker.id, newCase.id, { source: 'whatsapp' }); makeAudit('ai_triage_suggested', 'system:ai-triage', newCase.id, aiTriage); whatsappSessions.set(phone, session);
    whatsappResponse(res, language === 'en' ? `Your case ${newCase.id} was created.\\n\\n${whatsappMenu(language)}` : `आपका मामला ${newCase.id} बन गया है।\\n\\n${whatsappMenu(language)}`); return;
  }
  if (session.state === 'case_status') {
    const target = cases.find((item) => item.id === text && item.workerId === worker.id);
    session.state = 'menu'; whatsappSessions.set(phone, session);
    whatsappResponse(res, target ? `${target.id}: ${target.status}` : (language === 'en' ? 'Case not found. Check the case ID and try again.' : 'मामला नहीं मिला। ID जांचकर फिर कोशिश करें।')); return;
  }
  if (session.state === 'safety_choice' && (upper === 'SAFE' || upper === 'HELP')) {
    session.state = 'menu';
    const status = upper === 'HELP' ? 'unsafe' : 'safe';
    const checkIn = { id: randomUUID(), workerId: worker.id, status, hazard: status === 'unsafe' ? 'whatsapp distress' : null, locationConsent: false, location: null, notes: 'WhatsApp check-in', createdAt: new Date().toISOString(), source: 'whatsapp' };
    checkIns.push(checkIn); makeAudit('check_in_created', worker.id, checkIn.id, { source: 'whatsapp' });
    if (status === 'unsafe') createSafetyAlert({ workerId: worker.id, kind: 'emergency_checkin', location: null, locationConsent: false, details: { source: 'whatsapp' } });
    whatsappSessions.set(phone, session);
    whatsappResponse(res, status === 'unsafe' ? `${emergencyDisclaimer}\\n\\n${language === 'en' ? 'Help alert sent. If life-threatening, call 112.' : 'मदद का अलर्ट भेज दिया गया। जान को खतरा हो तो 112 पर कॉल करें।'}` : (language === 'en' ? `You are marked safe.\\n\\n${whatsappMenu(language)}` : `आप सुरक्षित दर्ज हैं।\\n\\n${whatsappMenu(language)}`));
    return;
  }
  if (text === '1') { session.state = 'wage_amount'; whatsappSessions.set(phone, session); whatsappResponse(res, language === 'en' ? 'Reply with the amount received, for example 500.' : 'मिली हुई रकम भेजें, जैसे 500।'); return; }
  if (text === '2') {
    const status = upper.includes('HELP') ? 'unsafe' : 'safe';
    if (upper === '2') { session.state = 'safety_choice'; whatsappSessions.set(phone, session); whatsappResponse(res, language === 'en' ? 'Reply SAFE or HELP.' : 'SAFE या HELP भेजें।'); return; }
    const checkIn = { id: randomUUID(), workerId: worker.id, status, hazard: status === 'unsafe' ? 'whatsapp distress' : null, locationConsent: false, location: null, notes: 'WhatsApp check-in', createdAt: new Date().toISOString(), source: 'whatsapp' };
    checkIns.push(checkIn);
    if (status === 'unsafe') createSafetyAlert({ workerId: worker.id, kind: 'emergency_checkin', location: null, locationConsent: false, details: { source: 'whatsapp' } });
    session.state = 'menu'; whatsappSessions.set(phone, session); makeAudit('check_in_created', worker.id, checkIn.id, { source: 'whatsapp' });
    whatsappResponse(res, status === 'unsafe' ? `${emergencyDisclaimer}\\n\\n${language === 'en' ? 'Help alert sent. If life-threatening, call 112.' : 'मदद का अलर्ट भेज दिया गया। जान को खतरा हो तो 112 पर कॉल करें।'}` : (language === 'en' ? `You are marked safe.\\n\\n${whatsappMenu(language)}` : `आप सुरक्षित दर्ज हैं।\\n\\n${whatsappMenu(language)}`)); return;
  }
  if (text === '3') { session.state = 'complaint_detail'; whatsappSessions.set(phone, session); whatsappResponse(res, language === 'en' ? 'Reply with a short description of the problem. You can add more detail in the app.' : 'समस्या का छोटा विवरण भेजें। अधिक जानकारी ऐप में जोड़ सकते हैं।'); return; }
  if (text === '4') { session.state = 'case_status'; whatsappSessions.set(phone, session); whatsappResponse(res, language === 'en' ? 'Reply with your case ID.' : 'अपने मामले की ID भेजें।'); return; }
  if (text === '5') { whatsappResponse(res, `${process.env.WHATSAPP_APP_URL || 'http://localhost:5173'}/worker`); return; }
  whatsappResponse(res, whatsappMenu(language));
}

function whatsappResponse(res, message) {
  res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' });
  res.end(`<Response><Message>${xmlEscape(message)}</Message></Response>`);
}

async function sendWhatsAppNotification(phone, message) {
  if (process.env.WHATSAPP_PROVIDER !== 'twilio') return { provider: 'stub' };
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WHATSAPP_FROM) throw new Error('WhatsApp provider is not configured.');
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: process.env.TWILIO_WHATSAPP_FROM, To: `whatsapp:${phone}`, Body: message }),
  });
  if (!response.ok) throw new Error('WhatsApp provider rejected notification.');
  return { provider: 'twilio' };
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
        const contentType = String(req.headers['content-type'] || '');
        resolve(contentType.includes('application/x-www-form-urlencoded')
          ? Object.fromEntries(new URLSearchParams(body))
          : JSON.parse(body));
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

// ---- Phase 33: anti bulk/bot sign-up limits -------------------------------
// Phase 8 limits stop brute force; these are tuned against bulk sign-up
// campaigns (many accounts from one IP, OTP farming, complaint flooding).
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function hitRateLimit(key, limit, windowMs) {
  const allowed = checkRateLimit(key, limit, windowMs);
  if (!allowed) {
    makeAudit('abuse_limit_triggered', 'system', key, { limit, windowMs });
  }
  return allowed;
}

// ---- Phase 33: Fraud & Abuse Prevention -----------------------------------
// Design rule for this whole section: signals flag for human review, they never
// auto-reject. A real worker with a slow connection or a genuine duplicate
// report must never be silently blocked — caseworkers see the flag and decide.

// Lightweight normalization so "URGENT help me" and "urgent   help me" match.
function complaintFingerprint(text) {
  return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function spamSignalsIn(text) {
  const signals = [];
  const normalized = complaintFingerprint(text);
  if (!normalized) return signals;
  if (normalized.length < 12) signals.push('very_short_text');
  if (/(https?:\/\/|www\.)\S+/.test(normalized)) signals.push('contains_link');
  if (/(\d)\1{6,}/.test(normalized)) signals.push('repeated_digits');
  if (/(.)\1{9,}/.test(normalized)) signals.push('repeated_characters');
  if (/\b(earn|income|cash|loan|kyc|otp|winner|lottery|refund|crypto|bet)\b/i.test(normalized)) signals.push('promo_terms');
  return signals;
}

// Flags a case for review in-place. Never blocks, never closes, never hides.
// Every complaint is recorded after screening so a LATER complaint from the
// same network can be compared against it — not just ones already flagged.
// Entries are pushed in time order, so old ones prune from the front.
function recordFraudScreenSeen(ip, text) {
  const now = Date.now();
  while (fraudScreens.length && now - fraudScreens[0].at > 24 * 60 * 60 * 1000) fraudScreens.shift();
  fraudScreens.push({ ip, fingerprint: complaintFingerprint(text), at: now });
}

function applyFraudScreening(newCase, { ip } = {}) {
  const signals = [];
  const fingerprint = complaintFingerprint(newCase.summary);
  const now = Date.now();
  // Exclude the new case itself: callers push it into `cases` before screening,
  // so without this guard every complaint would be flagged as a duplicate of
  // itself and the flag would be meaningless noise for caseworkers.
  const recentByWorker = cases.filter((item) => item.id !== newCase.id
    && item.workerId === newCase.workerId
    && complaintFingerprint(item.summary) === fingerprint
    && now - new Date(item.createdAt).getTime() <= 60 * 60 * 1000);
  if (recentByWorker.length >= 1) signals.push(`duplicate_recent_same_account:${recentByWorker[0].id}`);
  const recentByIp = ip
    ? fraudScreens.filter((item) => item.ip === ip && item.fingerprint === fingerprint && now - item.at <= 60 * 60 * 1000)
    : [];
  if (ip && !recentByWorker.length && recentByIp.length >= 1) signals.push('duplicate_recent_same_ip');
  const spam = spamSignalsIn(newCase.summary);
  if (spam.length) signals.push(`spam_patterns:${spam.join(',')}`);
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const lastDayByWorker = cases.filter((item) => item.id !== newCase.id && item.workerId === newCase.workerId && new Date(item.createdAt).getTime() >= dayAgo).length;
  if (lastDayByWorker >= 5) signals.push(`high_volume_same_account:${lastDayByWorker}in24h`);
  if (signals.length) {
    newCase.fraudReview = {
      flagged: true,
      signals,
      screenedAt: new Date().toISOString(),
      screenedBy: 'rules-v1',
      disposition: null,
      reviewedBy: null,
      reviewedAt: null,
    };
  }
  return newCase.fraudReview || null;
}

const fraudReasons = ['spam', 'duplicate', 'false_complaint', 'harassment', 'other'];

function serializeFraudReport(item) {
  return {
    id: item.id,
    caseId: item.caseId,
    workerId: item.workerId || null,
    reason: item.reason,
    detail: item.detail || '',
    reportedBy: item.reportedBy,
    reviewedBy: item.reviewedBy || null,
    reviewedAt: item.reviewedAt || null,
    createdAt: item.createdAt,
  };
}

// Platform-admin aggregate view of abuse patterns per account. Counts only —
// no case content, consistent with the platform panel's aggregate-only rule.
function fraudAbuseOverview() {
  const byWorker = new Map();
  for (const report of fraudReports) {
    if (!report.workerId) continue;
    const entry = byWorker.get(report.workerId) || { workerId: report.workerId, fraudReports: 0, reasons: {}, flaggedCases: 0, dismissedByCaseworker: 0, lastActivityAt: null };
    entry.fraudReports += 1;
    entry.reasons[report.reason] = (entry.reasons[report.reason] || 0) + 1;
    const reported = new Date(report.createdAt).getTime();
    if (!entry.lastActivityAt || reported > new Date(entry.lastActivityAt).getTime()) entry.lastActivityAt = report.createdAt;
    byWorker.set(report.workerId, entry);
  }
  for (const item of cases) {
    if (!item.fraudReview?.flagged) continue;
    const entry = byWorker.get(item.workerId) || { workerId: item.workerId, fraudReports: 0, reasons: {}, flaggedCases: 0, dismissedByCaseworker: 0, lastActivityAt: null };
    entry.flaggedCases += 1;
    if (item.fraudReview.disposition === 'dismissed') entry.dismissedByCaseworker += 1;
    const at = item.fraudReview.reviewedAt || item.fraudReview.screenedAt || item.createdAt;
    if (!entry.lastActivityAt || new Date(at) > new Date(entry.lastActivityAt)) entry.lastActivityAt = at;
    byWorker.set(item.workerId, entry);
  }
  return Array.from(byWorker.values())
    .sort((a, b) => (b.fraudReports + b.flaggedCases) - (a.fraudReports + a.flaggedCases));
}

function serializeApplication(item) {
  return {
    id: item.id,
    kind: item.kind,
    organizationName: item.organizationName,
    contactName: item.contactName,
    contactEmail: item.contactEmail,
    contactPhone: item.contactPhone || null,
    registrationNumber: item.registrationNumber || '',
    officialDomain: item.officialDomain || '',
    notes: item.notes || '',
    status: item.status,
    rejectionReason: item.rejectionReason || null,
    reviewedBy: item.reviewedBy || null,
    reviewedAt: item.reviewedAt || null,
    createdAt: item.createdAt,
  };
}

function serializeRecovery(item) {
  return {
    id: item.id,
    applicationId: item.applicationId || null,
    organizationName: item.applicationId && platformApplications.get(item.applicationId)?.organizationName || null,
    contactEmail: item.contactEmail,
    reason: item.reason,
    status: item.status,
    resolutionNote: item.resolutionNote || null,
    requestedBy: item.requestedBy,
    resolvedBy: item.resolvedBy || null,
    resolvedAt: item.resolvedAt || null,
    createdAt: item.createdAt,
  };
}

function findApplicationByEmail(email) {
  const key = String(email || '').trim().toLowerCase();
  return Array.from(platformApplications.values()).find((item) => item.contactEmail.toLowerCase() === key) || null;
}

function pendingApprovalFor(email, kind) {
  const item = findApplicationByEmail(email);
  return item && item.kind === kind && item.status === 'pending' ? item : null;
}

function platformSummary() {
  const values = Array.from(platformApplications.values());
  const active = values.filter((item) => item.status === 'approved');
  const ngoCaseCounts = new Map();
  for (const targetCase of cases) ngoCaseCounts.set(targetCase.owner, (ngoCaseCounts.get(targetCase.owner) || 0) + 1);
  return {
    generatedAt: new Date().toISOString(),
    organizations: {
      total: values.length,
      ngos: active.filter((item) => item.kind === 'ngo').length,
      employers: active.filter((item) => item.kind === 'employer').length,
      active: active.length,
      deactivated: values.filter((item) => item.status === 'deactivated').length,
    },
    queue: {
      pending: values.filter((item) => item.status === 'pending').length,
      pendingNgos: values.filter((item) => item.status === 'pending' && item.kind === 'ngo').length,
      pendingEmployers: values.filter((item) => item.status === 'pending' && item.kind === 'employer').length,
    },
    cases: {
      total: cases.length,
      open: cases.filter((item) => item.status !== 'resolved').length,
      resolved: cases.filter((item) => item.status === 'resolved').length,
    },
    workers: { total: workers.size },
    recoveryRequests: Array.from(accountRecovery.values()).filter((item) => item.status === 'pending').length,
    referenceData: { minimumWageRates: minimumWages.size, welfareSchemes: welfareSchemes.size },
  };
}

function platformOverview() {
  const responseHours = [];
  for (const targetCase of cases) {
    if (targetCase.status === 'resolved') {
      const hours = (new Date(targetCase.updatedAt) - new Date(targetCase.createdAt)) / 3600000;
      if (Number.isFinite(hours) && hours >= 0) responseHours.push(hours);
    }
  }
  const openByStatus = {};
  for (const targetCase of cases) {
    if (targetCase.status !== 'resolved') openByStatus[targetCase.status] = (openByStatus[targetCase.status] || 0) + 1;
  }
  const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
  return {
    generatedAt: new Date().toISOString(),
    aggregateOnly: true,
    organizations: { active: Array.from(platformApplications.values()).filter((item) => item.status === 'approved').length, deactivated: Array.from(platformApplications.values()).filter((item) => item.status === 'deactivated').length },
    cases: { total: cases.length, open: cases.filter((item) => item.status !== 'resolved').length, openByStatus, resolved: cases.filter((item) => item.status === 'resolved').length, createdLast30Days: cases.filter((item) => new Date(item.createdAt).getTime() >= thirtyDaysAgo).length },
    workers: { total: workers.size, registeredLast30Days: Array.from(workers.values()).filter((item) => new Date(item.createdAt).getTime() >= thirtyDaysAgo).length },
    alerts: { pending: alerts.filter((item) => item.status === 'pending').length, escalated: alerts.filter((item) => item.status === 'escalated').length, acknowledged: alerts.filter((item) => item.status === 'acknowledged').length },
    medianResponseHours: responseHours.length ? Math.round(responseHours.sort((a, b) => a - b)[Math.floor(responseHours.length / 2)] * 10) / 10 : null,
    channels: { whatsapp: cases.filter((item) => item.source === 'whatsapp').length, sms: cases.filter((item) => item.source === 'sms').length, ussd: cases.filter((item) => item.source === 'ussd').length, app: cases.filter((item) => !item.source || item.source === 'app').length },
  };
}

// Creating an organization record (id, verified worksite QR seeds) is kept
// together so approval always provisions the same things regardless of caller.
function approveApplication(actor, item) {
  item.status = 'approved';
  item.rejectionReason = null;
  item.reviewedBy = actor.sub;
  item.reviewedAt = new Date().toISOString();
  if (item.kind === 'employer') {
    const worksite = { id: randomUUID(), employerId: item.contactEmail, name: `${item.organizationName} (main site)`, registrationCode: `site-${randomUUID()}`, verified: true, createdAt: new Date().toISOString() };
    worksites.set(worksite.registrationCode, worksite);
    makeAudit('worksite_qr_created', 'system:approval', worksite.id, { name: worksite.name, onBehalfOf: item.contactEmail });
  }
  for (const [jti, session] of sessions) {
    if (session.subject === item.contactEmail) sessions.delete(jti);
  }
  makeAudit(`${item.kind}_application_approved`, actor.sub, item.id, { organization: item.organizationName, contactEmail: item.contactEmail });
  persist();
  return item;
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

function serializeWageRate(rate) {
  return { id: rate.id, state: rate.state, workerCategory: rate.workerCategory, dailyAmount: Number(rate.dailyAmount), currency: rate.currency, effectiveFrom: rate.effectiveFrom, sourceNote: rate.sourceNote, updatedAt: rate.updatedAt };
}

function getWorkerDashboard(workerId) {
  const worker = Array.from(workers.values()).find((item) => item.id === workerId);
  if (!worker) {
    return null;
  }

  function wageRateFor(worker) {
    const state = String(worker?.profile?.state || worker?.profile?.originState || '').trim();
    const category = String(worker?.profile?.workerCategory || 'unskilled_construction').trim();
    return minimumWages.get(`${state.toLowerCase()}::${category}`) || minimumWages.get(`all india::${category}`) || null;
  }

  function assessWage(worker, wageEntry) {
    const rate = wageRateFor(worker);
    if (!rate) return { status: 'not_available', message: 'No reference rate is set for your state and work category yet.', nextStep: 'You can continue recording your wage or ask an NGO caseworker to update your details.' };
    const below = Number(wageEntry.amount) < Number(rate.dailyAmount);
    return {
      status: below ? 'may_be_below_reference' : 'at_or_above_reference',
      dailyReference: Number(rate.dailyAmount),
      state: rate.state,
      workerCategory: rate.workerCategory,
      effectiveFrom: rate.effectiveFrom,
      sourceNote: rate.sourceNote,
      message: below
        ? 'This looks below the standard minimum wage reference for your state/category. Official rates can vary by shift, skill level, and the latest government notification.'
        : 'This wage is at or above the current reference rate for your state/category. Keep recording your wages so you have your own record.',
      nextStep: 'Would you like to file a complaint about this?',
      nextStepNeutral: 'You can also simply keep this entry in your wage history — no action is needed.',
    };
  }

  function matchingSchemes(workerProfile = {}) {
    const age = Number(workerProfile.age);
    const state = String(workerProfile.state || workerProfile.originState || '').trim().toLowerCase();
    const category = String(workerProfile.workerCategory || '').trim().toLowerCase();
    return Array.from(welfareSchemes.values()).filter((scheme) => {
      if (!scheme.active) return false;
      if (Number.isFinite(age) && scheme.minAge !== null && age < scheme.minAge) return false;
      if (Number.isFinite(age) && scheme.maxAge !== null && age > scheme.maxAge) return false;
      const states = scheme.states.map((item) => String(item).toLowerCase());
      if (states.length && !states.includes('all india') && state && !states.includes(state)) return false;
      const categories = scheme.workerCategories.map((item) => String(item).toLowerCase());
      return !categories.length || categories.includes(category);
    });
  }

  function localizeScheme(scheme, language = 'en') {
    const override = scheme.languages && typeof scheme.languages === 'object' ? scheme.languages[language] : null;
    if (!override || typeof override !== 'object') {
      return { id: scheme.id, slug: scheme.slug, name: scheme.name, description: scheme.description, eligibility: scheme.eligibility, registrationInstructions: scheme.registrationInstructions, officialUrl: scheme.officialUrl, languages: scheme.languages };
    }
    return {
      id: scheme.id,
      slug: scheme.slug,
      name: String(override.name || scheme.name),
      description: String(override.description || scheme.description),
      eligibility: String(override.eligibility || scheme.eligibility),
      registrationInstructions: String(override.registrationInstructions || scheme.registrationInstructions),
      officialUrl: scheme.officialUrl,
      languages: scheme.languages,
    };
  }

  function relationshipsFor(workerId) {
    return Array.from(workRelationships.values())
      .filter((item) => item.workerId === workerId)
      .sort((a, b) => (a.active === b.active ? String(b.createdAt).localeCompare(String(a.createdAt)) : a.active ? -1 : 1));
  }

  function incomeByRelationship(workerId) {
    const totals = new Map();
    let combined = 0;
    for (const entry of wageEntries) {
      if (entry.workerId !== workerId) continue;
      const key = entry.relationshipId || 'unlinked';
      const amount = Number(entry.amount) || 0;
      totals.set(key, (totals.get(key) || 0) + amount);
      combined += amount;
    }
    return { combined, relationships: Array.from(totals.entries()).map(([relationshipId, total]) => ({ relationshipId, total })) };
  }

  return {
    worker,
    wageEntries: wageEntries.filter((entry) => entry.workerId === workerId),
    checkIns: checkIns.filter((entry) => entry.workerId === workerId),
    cases: cases.filter((entry) => entry.workerId === workerId),
    workRelationships: relationshipsFor(workerId),
    incomeByRelationship: incomeByRelationship(workerId),
    schemes: matchingSchemes(worker.profile).map((scheme) => localizeScheme(scheme, worker.language)),
  };
}

function findCase(caseId) {
  return cases.find((item) => item.id === caseId);
}

function evidenceAccess(actor, targetCase, evidence) {
  return actor.role === 'worker'
    ? targetCase.workerId === actor.sub && evidence.uploaderId === actor.sub
    : (actor.role === 'ngo_admin' || targetCase.owner === actor.sub);
}

function createSafetyAlert({ caseId = null, workerId, kind, location, locationConsent, details = {} }) {
  const now = new Date();
  const alert = {
    id: randomUUID(), caseId, workerId, kind, priority: 'high', status: 'pending',
    recipient: 'ngo-caseworkers', channel: 'in_app_and_external_stub',
    createdAt: now.toISOString(), dueAt: new Date(now.getTime() + alertAckWindowMs).toISOString(),
    acknowledgedAt: null, acknowledgedBy: null, actionTaken: null, falseAlarmReason: null,
    escalatedAt: null, location: locationConsent ? location || null : null,
    locationConsent: Boolean(locationConsent), details,
  };
  alerts.unshift(alert);
  const notified = notifyTrustedContacts(workerId, kind, alert);
  makeAudit('high_risk_alert_created', workerId, caseId || alert.id, { alertId: alert.id, kind, externalNotification: 'stubbed', trustedContactsNotified: notified.length });
  return alert;
}

function confirmedContacts(workerId) {
  return Array.from(trustedContacts.values())
    .filter((item) => item.workerId === workerId && item.status === 'confirmed')
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function notifyTrustedContacts(workerId, kind, alert) {
  const contacts = confirmedContacts(workerId);
  const message = contacts.length
    ? (kind === 'emergency_checkin'
      ? `Emergency alert: Your contact needs help. Pehchaan recorded an emergency check-in. If you can reach them, please check on them now. Emergency services: 112.`
      : `Pehchaan safety alert: A safety alert was recorded for your contact. NGO caseworkers are being notified.`)
    : [];
  const delivered = [];
  for (const contact of contacts) {
    void sendSms(contact.phone, message)
      .then((result) => {
        if (result.provider === 'twilio') {
          makeAudit('trusted_contact_notified', workerId, alert.caseId || alert.id, { contactId: contact.id, alertId: alert.id, channel: 'sms' });
        }
      })
      .catch(() => makeAudit('trusted_contact_notification_failed', workerId, alert.caseId || alert.id, { contactId: contact.id, alertId: alert.id }));
    delivered.push(contact.id);
  }
  return delivered;
}

function escalateDueAlerts() {
  const now = Date.now();
  for (const alert of alerts) {
    if (alert.status === 'pending' && !alert.escalatedAt && Date.parse(alert.dueAt) <= now) {
      alert.status = 'escalated';
      alert.escalatedAt = new Date().toISOString();
      // Link, don't duplicate: this notification points at the Phase 11 alert;
      // the alert itself keeps its own escalation record and ack workflow.
      notifyNgoCaseworkers({ caseId: alert.caseId, type: 'alert_escalated', title: 'Safety alert needs acknowledgement', body: `Alert ${alert.id} escalated past its ${Math.round((alertAckWindowMs || 15 * 60 * 1000) / 60000)}-minute window. Open the alert inbox to acknowledge.`, meta: { alertId: alert.id, kind: alert.kind } });
      makeAudit('alert_escalated', 'system', alert.caseId || alert.id, { alertId: alert.id, notified: 'ngo_admin' });
    }
  }
}

setInterval(escalateDueAlerts, 60 * 1000);

function analyticsRange(url) {
  const now = Date.now();
  const range = url.searchParams.get('range') || 'month';
  const start = url.searchParams.get('from');
  const end = url.searchParams.get('to');
  if (start && end) return { from: new Date(start), to: new Date(`${end}T23:59:59.999Z`) };
  const days = range === 'quarter' ? 90 : 30;
  return { from: new Date(now - days * 24 * 60 * 60 * 1000), to: new Date(now) };
}

function buildAnalytics(url) {
  const { from, to } = analyticsRange(url);
  const includedCases = cases.filter((item) => {
    const created = new Date(item.createdAt);
    return created >= from && created <= to;
  });
  const category = { wage: 0, safety: 0, other: 0 };
  const byStatus = {};
  const byDay = {};
  for (const item of includedCases) {
    const key = item.type === 'wage_theft' ? 'wage' : item.type === 'unsafe_site' ? 'safety' : 'other';
    category[key] += 1;
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    const day = item.createdAt.slice(0, 10);
    byDay[day] = byDay[day] || { documented: 0, resolved: 0, open: 0 };
    byDay[day].documented += 1;
    if (item.status === 'resolved') byDay[day].resolved += 1; else byDay[day].open += 1;
  }
  const responseTimes = includedCases.filter((item) => item.status === 'resolved').map((item) => Math.max(0, new Date(item.updatedAt) - new Date(item.createdAt)));
  const language = {};
  for (const worker of workers.values()) language[worker.language || 'unknown'] = (language[worker.language || 'unknown'] || 0) + 1;
  const regions = {};
  for (const worker of workers.values()) {
    const region = String(worker.profile?.origin || '').trim();
    if (region) regions[region] = (regions[region] || 0) + 1;
  }
  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    workersSupported: new Set(includedCases.map((item) => item.workerId)).size,
    casesDocumented: includedCases.length,
    casesByCategory: category,
    averageResponseHours: responseTimes.length ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length / 3600000 * 10) / 10 : 0,
    casesByStatus: byStatus,
    casesOverTime: Object.entries(byDay).map(([date, values]) => ({ date, ...values })),
    geographicDistribution: regions,
    languageUsage: language,
  };
}

async function supabaseStorage(pathname, method, body = null) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Secure evidence storage is not configured.');
  const response = await fetch(`${base.replace(/\/$/, '')}/storage/v1${pathname}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload.message || payload.error || 'Storage request failed.'));
  return payload;
}

function buildWorkerExport(workerId, format = 'json') {
  const wanted = ['json', 'csv', 'pdf'].includes(String(format).toLowerCase()) ? String(format).toLowerCase() : 'json';
  const worker = Array.from(workers.values()).find((item) => item.id === workerId);
  const relationships = Array.from(workRelationships.values()).filter((item) => item.workerId === workerId);
  const ownWages = wageEntries.filter((item) => item.workerId === workerId);
  const ownCheckIns = checkIns.filter((item) => item.workerId === workerId);
  const ownCases = cases.filter((item) => item.workerId === workerId);
  const data = {
    exportedAt: new Date().toISOString(),
    disclaimer: legalDisclaimer,
    worker: {
      phone: worker?.phone || '',
      language: worker?.language || 'en',
      profile: worker?.profile || {},
      createdAt: worker?.createdAt || null,
    },
    workRelationships: relationships.map((item) => ({ label: item.label, employerName: item.employerName, siteName: item.siteName, category: item.category, startedOn: item.startedOn, endedOn: item.endedOn, active: item.active })),
    wageHistory: ownWages.map((item) => ({ date: item.date, type: item.type, amount: item.amount, deductions: item.deductions, overtime: item.overtime, source: item.source || 'app', relationship: relationships.find((rel) => rel.id === item.relationshipId)?.label || null })),
    checkIns: ownCheckIns.map((item) => ({ createdAt: item.createdAt, status: item.status, hazard: item.hazard, notes: item.notes, source: item.source || 'app' })),
    cases: ownCases.map((item) => ({ id: item.id, type: item.type, status: item.status, priority: item.priority, summary: item.summary, createdAt: item.createdAt, updatedAt: item.updatedAt, relationship: relationships.find((rel) => rel.id === item.relationshipId)?.label || null })),
    totals: {
      wageEntries: ownWages.length,
      totalWageAmount: ownWages.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
      checkIns: ownCheckIns.length,
      cases: ownCases.length,
    },
  };
  if (wanted === 'json') return { format: 'json', formatLabel: 'JSON', data };

  const csvCell = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = [];
  rows.push(['Section', 'Date', 'Type/Status', 'Amount', 'Details', 'Work relationship'].map(csvCell).join(','));
  for (const item of data.wageHistory) rows.push(['Wage', item.date, item.type, item.amount, `deductions ${item.deductions} / overtime ${item.overtime} / ${item.source}`, item.relationship || ''].map(csvCell).join(','));
  for (const item of data.checkIns) rows.push(['Check-in', item.createdAt, item.status, '', item.hazard || item.notes || '', ''].map(csvCell).join(','));
  for (const item of data.cases) rows.push(['Case', item.createdAt, `${item.type} / ${item.status}`, '', item.summary, item.relationship || ''].map(csvCell).join(','));
  if (wanted === 'csv') return { format: 'csv', formatLabel: 'CSV', data, body: rows.join('\r\n') };

  return { format: 'pdf', formatLabel: 'PDF', data };
}

function renderWorkerExportPdf(data, language = 'en') {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const document = new PDFDocument({ margin: 54 });
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    const hindiFont = 'C:\\Windows\\Fonts\\Nirmala.ttf';
    if (language === 'hi' && fs.existsSync(hindiFont)) document.font(hindiFont);
    document.fontSize(18).text('Pehchaan - My record');
    document.moveDown(0.5).fontSize(10).text(`Exported: ${new Date(data.exportedAt).toLocaleString(language === 'hi' ? 'hi-IN' : 'en-IN')}`);
    document.fontSize(10).text(`Worker phone: ${data.worker.phone}`);
    document.moveDown(1).fontSize(14).text('Summary');
    document.fontSize(11).text(`Wage entries: ${data.totals.wageEntries} (total recorded Rs ${data.totals.totalWageAmount})`);
    document.text(`Safety check-ins: ${data.totals.checkIns}`);
    document.text(`Cases / complaints: ${data.totals.cases}`);
    document.moveDown(1).fontSize(14).text('Wage history');
    if (!data.wageHistory.length) document.fontSize(11).text('No wage entries recorded.');
    for (const item of data.wageHistory) document.fontSize(11).text(`${new Date(item.date).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN')} - ${item.type} - Rs ${item.amount}${item.relationship ? ` (${item.relationship})` : ''}`);
    document.moveDown(1).fontSize(14).text('Safety check-ins');
    if (!data.checkIns.length) document.fontSize(11).text('No check-ins recorded.');
    for (const item of data.checkIns.slice(0, 60)) document.fontSize(11).text(`${new Date(item.createdAt).toLocaleString(language === 'hi' ? 'hi-IN' : 'en-IN')} - ${item.status}${item.hazard ? ` - ${item.hazard}` : ''}`);
    document.moveDown(1).fontSize(14).text('Cases / complaints');
    if (!data.cases.length) document.fontSize(11).text('No cases recorded.');
    for (const item of data.cases) {
      document.fontSize(11).text(`${item.id} - ${item.type} - ${item.status} (${new Date(item.createdAt).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN')})`);
      document.fontSize(10).text(item.summary || '', { indent: 12 });
    }
    document.moveDown(2).fontSize(9).text(data.disclaimer);
    document.end();
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  escalateDueAlerts();

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
      database: databaseConfigured() ? 'postgresql' : 'not_configured',
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/whatsapp/webhook') {
    const challenge = url.searchParams.get('hub.challenge');
    if (url.searchParams.get('hub.verify_token') === (process.env.WHATSAPP_VERIFY_TOKEN || 'replace-with-webhook-verify-token') && challenge) {
      res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(challenge);
    } else jsonResponse(res, 403, { error: 'Webhook verification failed.' });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/whatsapp/webhook') {
    try { await handleWhatsAppMessage(req, res); } catch (error) { jsonResponse(res, 400, { error: error.message || 'WhatsApp message could not be handled.' }); }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/sms/webhook') {
    try { await handleSmsMessage(req, res); } catch (error) { smsReply(res, `ERROR: ${error.message || 'SMS could not be handled.'}`); }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/ussd') {
    try {
      const body = await parseBody(req);
      const phone = whatsappPhone(body.phoneNumber || body.phone || body.MSISDN);
      const text = String(body.text || '').trim();
      const worker = ensureWorker(phone);
      const language = worker.language === 'en' ? 'en' : 'hi';
      const menu = language === 'en' ? 'CON Pehchaan\\n1 Safe\\n2 Need help\\n3 Case status\\n4 NGO helpline' : 'CON पहचान\\n1 सुरक्षित\\n2 मदद चाहिए\\n3 मामले की स्थिति\\n4 NGO हेल्पलाइन';
      if (!text) { smsReply(res, menu); return; }
      const choice = text.split('*').pop();
      if (choice === '1') {
        const checkIn = { id: randomUUID(), workerId: worker.id, status: 'safe', hazard: null, locationConsent: false, location: null, notes: 'USSD check-in', createdAt: new Date().toISOString(), source: 'ussd' };
        checkIns.push(checkIn); makeAudit('check_in_created', worker.id, checkIn.id, { source: 'ussd' }); smsReply(res, language === 'en' ? 'END Safe check-in recorded.' : 'END सुरक्षित जांच दर्ज।'); return;
      }
      if (choice === '2') {
        createSafetyAlert({ workerId: worker.id, kind: 'emergency_checkin', location: null, locationConsent: false, details: { source: 'ussd' } }); makeAudit('ussd_help_requested', worker.id, worker.id, {}); smsReply(res, language === 'en' ? 'END Help alert sent. Call 112 if in danger.' : 'END मदद का अलर्ट भेजा गया। खतरे में 112 कॉल करें।'); return;
      }
      if (choice === '3') { smsReply(res, `END ${cases.filter((item) => item.workerId === worker.id).slice(-3).map((item) => `${item.id}: ${item.status}`).join(', ') || (language === 'en' ? 'No cases.' : 'कोई मामला नहीं।')}`); return; }
      if (choice === '4') { smsReply(res, `END ${process.env.NGO_HELPLINE || 'Please contact your local NGO helpline.'}`); return; }
      smsReply(res, menu);
    } catch (error) { smsReply(res, `END ERROR: ${error.message || 'USSD unavailable.'}`); }
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
      // Phase 33: bulk sign-up abuse limits — OTP farming means many requests
      // across many numbers from one network. hitRateLimit records the hit
      // whether or not the request later succeeds.
      if (!hitRateLimit(`otp-request-ip:${clientIp(req)}`, 30, 24 * 60 * 60 * 1000)) {
        jsonResponse(res, 429, { error: 'Too many verification requests from this network today. Please try again tomorrow or contact support.' });
        return;
      }
      const worker = ensureWorker(phone);
      const otp = allowDemoOtp ? '123456' : String(randomInt(100000, 1000000));
      await sendOtp(phone, otp);
      otpChallenges.set(phone, { otpHash: hash(otp), workerId: worker.id, expiresAt: Date.now() + otpTtlMs, attempts: 0 });
      makeAudit('otp_requested', 'system', worker.id, { phone, otpSent: true, demo: allowDemoOtp, ip: clientIp(req) });

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
      // Phase 33: account-creation abuse limit — many NEW accounts from one
      // IP in a day is a bot-farm signal. Accounts that already existed are
      // exempt, so real users re-verifying are never blocked.
      const recentlyExisted = Array.from(workers.values()).some((item) => item.id === challenge.workerId && new Date(item.createdAt).getTime() < Date.now() - 60 * 1000);
      if (!recentlyExisted && !hitRateLimit(`worker-signup-ip:${clientIp(req)}`, 8, 24 * 60 * 60 * 1000)) {
        jsonResponse(res, 429, { error: 'Too many new accounts from this network today. Please try again tomorrow or contact support.' });
        return;
      }

      const worker = ensureWorker(phone);
      otpChallenges.delete(phone);
      if (!recentlyExisted) {
        makeAudit('worker_account_created', worker.id, worker.id, { phone, ip: clientIp(req) });
      }
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

    const adminLogin = body.email === (process.env.NGO_ADMIN_EMAIL || 'admin@pehchaan.org') && body.password === (process.env.NGO_ADMIN_PASSWORD || 'demo');
    const caseworkerLogin = body.email === (process.env.NGO_DEMO_EMAIL || 'ngo@pehchaan.org') && body.password === (process.env.NGO_DEMO_PASSWORD || 'demo');
    if (!adminLogin && !caseworkerLogin) {
      if (!checkRateLimit(`ngo-login-failed:${req.socket.remoteAddress}`, 10, 15 * 60 * 1000)) {
        jsonResponse(res, 429, { error: 'Too many login attempts. Please wait and try again.' });
        return;
      }
      jsonResponse(res, 401, { error: 'Invalid organization credentials.' });
      return;
    }
    // Phase 31: organization logins respect the platform approval lifecycle.
    // A missing application record keeps the seeded demo accounts working.
    const ngoApplication = findApplicationByEmail(body.email);
    if (ngoApplication && ngoApplication.status !== 'approved') {
      const reason = ngoApplication.status === 'pending'
        ? 'Your organization account is awaiting platform approval.'
        : ngoApplication.status === 'deactivated'
          ? 'This organization account has been deactivated by the platform team.'
          : 'This organization application was not approved. Contact the platform team.';
      jsonResponse(res, 403, { error: reason });
      return;
    }
    const role = adminLogin ? 'ngo_admin' : 'ngo_caseworker';
    const access = issueSession(body.email, role);
    const refresh = issueSession(body.email, role, 'refresh');
    jsonResponse(res, 200, { accessToken: access.token, refreshToken: refresh.token, expiresIn: 900, user: { id: body.email, role } });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/platform-login') {
    const body = await parseBody(req);
    if (body.email !== (process.env.PLATFORM_ADMIN_EMAIL || 'platform@pehchaan.org') || body.password !== (process.env.PLATFORM_ADMIN_PASSWORD || 'demo')) {
      if (!checkRateLimit(`platform-login-failed:${req.socket.remoteAddress}`, 10, 15 * 60 * 1000)) {
        jsonResponse(res, 429, { error: 'Too many login attempts. Please wait and try again.' });
        return;
      }
      jsonResponse(res, 401, { error: 'Invalid platform credentials.' });
      return;
    }
    const access = issueSession(body.email, 'platform_admin');
    const refresh = issueSession(body.email, 'platform_admin', 'refresh');
    jsonResponse(res, 200, { accessToken: access.token, refreshToken: refresh.token, expiresIn: 900, user: { id: body.email, role: 'platform_admin' } });
    return;
  }

  // Organization sign-ups (Phases 7 and 16) now land in the platform approval
  // queue instead of going live immediately. Credentials do not exist until a
  // platform admin approves the application.
  if (req.method === 'POST' && pathname === '/api/platform/signup') {
    const body = await parseBody(req);
    const kind = body.kind === 'employer' ? 'employer' : 'ngo';
    const organizationName = String(body.organizationName || '').trim();
    const contactName = String(body.contactName || '').trim();
    const contactEmail = String(body.contactEmail || '').trim().toLowerCase();
    if (!organizationName || !contactName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
      jsonResponse(res, 400, { error: 'Organization name, contact name, and a valid contact email are required.' });
      return;
    }
    if (findApplicationByEmail(contactEmail)) {
      jsonResponse(res, 409, { error: 'An application or account with this email already exists.' });
      return;
    }
    // Phase 33: the approval step must have something real to check. Every
    // application carries at least one verifiable reference.
    const registrationNumber = String(body.registrationNumber || '').trim();
    const officialDomain = String(body.officialDomain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/^www\./, '');
    const hasDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(officialDomain);
    if (!registrationNumber && !hasDomain) {
      jsonResponse(res, 400, { error: 'A registration number or an official email/website domain is required so the platform team can verify the organization.' });
      return;
    }
    if (registrationNumber && registrationNumber.length < 4) {
      jsonResponse(res, 400, { error: 'The registration number looks too short to be real.' });
      return;
    }
    if (!checkRateLimit(`platform-signup:${req.socket.remoteAddress}`, 5, 15 * 60 * 1000)) {
      jsonResponse(res, 429, { error: 'Too many applications from this network. Please try again later.' });
      return;
    }
    if (!checkRateLimit(`platform-signup-day:${req.socket.remoteAddress}`, 10, 24 * 60 * 60 * 1000)) {
      jsonResponse(res, 429, { error: 'Too many applications from this network today. Please try again tomorrow.' });
      return;
    }
    const application = {
      id: randomUUID(),
      kind,
      organizationName,
      contactName,
      contactEmail,
      contactPhone: String(body.contactPhone || '').trim() || null,
      registrationNumber,
      officialDomain: hasDomain ? officialDomain : null,
      notes: String(body.notes || '').trim(),
      status: 'pending',
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
    };
    platformApplications.set(application.id, application);
    makeAudit(`${kind}_application_submitted`, contactEmail, application.id, { organization: organizationName, registrationNumber: registrationNumber || null, officialDomain: application.officialDomain });
    persist();
    jsonResponse(res, 201, { submitted: true, application: serializeApplication(application), message: 'The Pehchaan team reviews every application before the account is activated.' });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/employer-login') {
    const body = await parseBody(req);
    if (body.email !== (process.env.EMPLOYER_DEMO_EMAIL || 'employer@pehchaan.org') || body.password !== (process.env.EMPLOYER_DEMO_PASSWORD || 'demo')) {
      if (!checkRateLimit(`employer-login-failed:${req.socket.remoteAddress}`, 10, 15 * 60 * 1000)) {
        jsonResponse(res, 429, { error: 'Too many login attempts. Please wait and try again.' });
        return;
      }
      jsonResponse(res, 401, { error: 'Invalid employer credentials.' });
      return;
    }
    const employerApplication = findApplicationByEmail(body.email);
    if (employerApplication && employerApplication.status !== 'approved') {
      const reason = employerApplication.status === 'pending'
        ? 'Your employer account is awaiting platform approval.'
        : employerApplication.status === 'deactivated'
          ? 'This employer account has been deactivated by the platform team.'
          : 'This employer application was not approved. Contact the platform team.';
      jsonResponse(res, 403, { error: reason });
      return;
    }
    const access = issueSession(body.email, 'employer');
    const refresh = issueSession(body.email, 'employer', 'refresh');
    jsonResponse(res, 200, { accessToken: access.token, refreshToken: refresh.token, expiresIn: 900, user: { id: body.email, role: 'employer' } });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/partner-login') {
    const body = await parseBody(req);
    if (body.email !== (process.env.PARTNER_DEMO_EMAIL || 'partner@pehchaan.org') || body.password !== (process.env.PARTNER_DEMO_PASSWORD || 'demo')) {
      if (!checkRateLimit(`partner-login-failed:${req.socket.remoteAddress}`, 10, 15 * 60 * 1000)) {
        jsonResponse(res, 429, { error: 'Too many login attempts. Please wait and try again.' });
        return;
      }
      jsonResponse(res, 401, { error: 'Invalid partner credentials.' });
      return;
    }
    const role = body.partnerRole === 'government' ? 'government' : 'funder';
    const access = issueSession(body.email, role);
    const refresh = issueSession(body.email, role, 'refresh');
    jsonResponse(res, 200, { accessToken: access.token, refreshToken: refresh.token, expiresIn: 900, user: { id: body.email, role } });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/analytics/impact') {
    const actor = authenticate(req, res, ['ngo_admin', 'government', 'funder']);
    if (!actor) return;
    jsonResponse(res, 200, buildAnalytics(url));
    return;
  }

  if (req.method === 'GET' && pathname === '/api/analytics/impact.csv') {
    const actor = authenticate(req, res, ['ngo_admin', 'government', 'funder']);
    if (!actor) return;
    const report = buildAnalytics(url);
    const rows = [
      ['metric', 'value'],
      ['workers_supported', report.workersSupported],
      ['cases_documented', report.casesDocumented],
      ['average_response_hours', report.averageResponseHours],
      ...Object.entries(report.casesByCategory).map(([key, value]) => [`cases_${key}`, value]),
      ...Object.entries(report.casesByStatus).map(([key, value]) => [`status_${key}`, value]),
      ...Object.entries(report.languageUsage).map(([key, value]) => [`language_${key}`, value]),
      ...Object.entries(report.geographicDistribution).map(([key, value]) => [`region_${key.replaceAll(',', ' ')}`, value]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="pehchaan-impact-summary.csv"' });
    res.end(csv);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/platform/overview') {
    const actor = authenticate(req, res, ['platform_admin']);
    if (!actor) return;
    jsonResponse(res, 200, { overview: platformOverview(), summary: platformSummary() });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/platform/applications') {
    const actor = authenticate(req, res, ['platform_admin']);
    if (!actor) return;
    const statusFilter = url.searchParams.get('status');
    const kindFilter = url.searchParams.get('kind');
    let items = Array.from(platformApplications.values());
    if (statusFilter) items = items.filter((item) => item.status === statusFilter);
    if (kindFilter) items = items.filter((item) => item.kind === kindFilter);
    items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    jsonResponse(res, 200, { applications: items.map(serializeApplication), total: items.length });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/platform/applications/decision') {
    const actor = authenticate(req, res, ['platform_admin']);
    if (!actor) return;
    const body = await parseBody(req);
    const item = platformApplications.get(String(body.id || ''));
    if (!item) { jsonResponse(res, 404, { error: 'Application not found.' }); return; }
    const decision = String(body.decision || '');
    if (decision === 'approve') {
      if (item.status === 'approved') { jsonResponse(res, 409, { error: 'This application is already approved.' }); return; }
      approveApplication(actor, item);
      jsonResponse(res, 200, { application: serializeApplication(item) });
      return;
    }
    if (decision === 'reject') {
      if (item.status !== 'pending') { jsonResponse(res, 409, { error: 'Only pending applications can be rejected.' }); return; }
      const reason = String(body.reason || '').trim();
      if (!reason) { jsonResponse(res, 400, { error: 'A rejection reason is required so the applicant can improve and reapply.' }); return; }
      item.status = 'rejected';
      item.rejectionReason = reason;
      item.reviewedBy = actor.sub;
      item.reviewedAt = new Date().toISOString();
      for (const [jti, session] of sessions) {
        if (session.subject === item.contactEmail) sessions.delete(jti);
      }
      makeAudit(`${item.kind}_application_rejected`, actor.sub, item.id, { organization: item.organizationName, reason });
      persist();
      jsonResponse(res, 200, { application: serializeApplication(item) });
      return;
    }
    if (decision === 'deactivate') {
      if (item.status !== 'approved') { jsonResponse(res, 409, { error: 'Only active organizations can be deactivated.' }); return; }
      item.status = 'deactivated';
      item.reviewedBy = actor.sub;
      item.reviewedAt = new Date().toISOString();
      for (const [jti, session] of sessions) {
        if (session.subject === item.contactEmail) sessions.delete(jti);
      }
      makeAudit(`${item.kind}_account_deactivated`, actor.sub, item.id, { organization: item.organizationName });
      persist();
      jsonResponse(res, 200, { application: serializeApplication(item) });
      return;
    }
    if (decision === 'reactivate') {
      if (item.status !== 'deactivated') { jsonResponse(res, 409, { error: 'Only deactivated organizations can be reactivated.' }); return; }
      approveApplication(actor, item);
      jsonResponse(res, 200, { application: serializeApplication(item) });
      return;
    }
    jsonResponse(res, 400, { error: 'Decision must be approve, reject, deactivate, or reactivate.' });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/platform/minimum-wages') {
    const actor = authenticate(req, res, ['platform_admin']);
    if (!actor) return;
    jsonResponse(res, 200, { rates: Array.from(minimumWages.values()).map(serializeWageRate) });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/platform/minimum-wages') {
    const actor = authenticate(req, res, ['platform_admin']);
    if (!actor) return;
    const body = await parseBody(req);
    const state = String(body.state || '').trim();
    const workerCategory = String(body.workerCategory || '').trim();
    const dailyAmount = Number(body.dailyAmount);
    const effectiveFrom = String(body.effectiveFrom || '').trim();
    if (!state || !workerCategory || !Number.isFinite(dailyAmount) || dailyAmount <= 0 || !effectiveFrom) {
      jsonResponse(res, 400, { error: 'State, category, positive daily amount, and effective date are required.' });
      return;
    }
    const key = `${state.toLowerCase()}::${workerCategory}`;
    const rate = { id: minimumWages.get(key)?.id || randomUUID(), state, workerCategory, dailyAmount, currency: 'INR', effectiveFrom, sourceNote: String(body.sourceNote || 'Admin-maintained reference; verify with the latest state notification.'), updatedAt: new Date().toISOString() };
    minimumWages.set(key, rate);
    makeAudit('minimum_wage_rate_updated', actor.sub, rate.id, { state, workerCategory, dailyAmount, effectiveFrom, scope: 'platform' });
    persist();
    jsonResponse(res, 200, { rate: serializeWageRate(rate) });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/platform/schemes') {
    const actor = authenticate(req, res, ['platform_admin']);
    if (!actor) return;
    jsonResponse(res, 200, { schemes: Array.from(welfareSchemes.values()) });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/platform/schemes') {
    const actor = authenticate(req, res, ['platform_admin']);
    if (!actor) return;
    const body = await parseBody(req);
    const slug = String(body.slug || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const eligibility = String(body.eligibility || '').trim();
    const registrationInstructions = String(body.registrationInstructions || '').trim();
    if (!slug || !name || !description || !eligibility || !registrationInstructions) {
      jsonResponse(res, 400, { error: 'Slug, name, description, eligibility, and registration instructions are required.' });
      return;
    }
    const existing = welfareSchemes.get(slug);
    const scheme = {
      id: existing?.id || randomUUID(), slug, name, description, eligibility, registrationInstructions,
      officialUrl: body.officialUrl ? String(body.officialUrl) : null,
      languages: body.languages && typeof body.languages === 'object' ? body.languages : {},
      states: Array.isArray(body.states) ? body.states.map(String) : ['All India'],
      workerCategories: Array.isArray(body.workerCategories) ? body.workerCategories.map(String) : [],
      minAge: body.minAge === null || body.minAge === undefined || body.minAge === '' ? null : Number(body.minAge),
      maxAge: body.maxAge === null || body.maxAge === undefined || body.maxAge === '' ? null : Number(body.maxAge),
      active: body.active !== false, updatedAt: new Date().toISOString(),
    };
    welfareSchemes.set(slug, scheme);
    if (!existing && scheme.active) {
      for (const worker of workers.values()) {
        if (matchingSchemes(worker.profile).some((item) => item.id === scheme.id)) {
          createNotification({ workerId: worker.id, type: 'scheme_matched', title: 'New scheme you may be eligible for', body: `${scheme.name}: ${scheme.eligibility.slice(0, 140)}`, meta: { schemeId: scheme.id, slug: scheme.slug } });
        }
      }
    }
    makeAudit('welfare_scheme_updated', actor.sub, scheme.id, { slug, active: scheme.active, scope: 'platform' });
    persist();
    jsonResponse(res, 200, { scheme });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/platform/accounts') {
    const actor = authenticate(req, res, ['platform_admin']);
    if (!actor) return;
    const applications = Array.from(platformApplications.values()).filter((item) => item.status === 'approved' || item.status === 'deactivated');
    jsonResponse(res, 200, { accounts: applications.map(serializeApplication), total: applications.length });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/platform/recovery') {
    // Unauthenticated: this is how a locked-out NGO/employer asks for help.
    const body = await parseBody(req);
    const contactEmail = String(body.contactEmail || '').trim().toLowerCase();
    const reason = String(body.reason || '').trim();
    if (!contactEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail) || !reason) {
      jsonResponse(res, 400, { error: 'A valid account email and a reason are required.' });
      return;
    }
    if (!checkRateLimit(`recovery:${req.socket.remoteAddress}`, 3, 15 * 60 * 1000)) {
      jsonResponse(res, 429, { error: 'Too many recovery requests. Please try again later.' });
      return;
    }
    const application = findApplicationByEmail(contactEmail);
    if (application) {
      const alreadyPending = Array.from(accountRecovery.values()).find((item) => item.status === 'pending' && (item.contactEmail === contactEmail || item.applicationId === application.id));
      if (alreadyPending) { jsonResponse(res, 409, { error: 'A recovery request for this account is already awaiting review.' }); return; }
    }
    const request = {
      id: randomUUID(),
      applicationId: application?.id || null,
      contactEmail,
      reason,
      status: 'pending',
      resolutionNote: null,
      requestedBy: contactEmail,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    };
    accountRecovery.set(request.id, request);
    makeAudit('account_recovery_requested', contactEmail, request.id, { applicationId: request.applicationId, matched: Boolean(application) });
    persist();
    jsonResponse(res, 201, { submitted: true, message: 'The Pehchaan platform team reviews every recovery request by hand before any account change.' });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/platform/recovery') {
    const actor = authenticate(req, res, ['platform_admin']);
    if (!actor) return;
    const items = Array.from(accountRecovery.values()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    jsonResponse(res, 200, { requests: items.map(serializeRecovery), total: items.length });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/platform/recovery/resolve') {
    const actor = authenticate(req, res, ['platform_admin']);
    if (!actor) return;
    const body = await parseBody(req);
    const request = accountRecovery.get(String(body.id || ''));
    if (!request) { jsonResponse(res, 404, { error: 'Recovery request not found.' }); return; }
    if (request.status !== 'pending') { jsonResponse(res, 409, { error: 'This recovery request was already resolved.' }); return; }
    const outcome = String(body.outcome || '');
    if (outcome !== 'grant' && outcome !== 'dismiss') {
      jsonResponse(res, 400, { error: 'Outcome must be grant or dismiss.' });
      return;
    }
    request.status = outcome === 'grant' ? 'resolved' : 'dismissed';
    request.resolutionNote = String(body.note || '').trim() || null;
    request.resolvedBy = actor.sub;
    request.resolvedAt = new Date().toISOString();
    const application = request.applicationId && platformApplications.get(request.applicationId);
    if (outcome === 'grant') {
      // Identity is verified by the platform team out of band; the grant
      // recovers a deactivated account or escalates the request for review.
      if (application && application.status === 'deactivated') {
        approveApplication(actor, application);
      }
      makeAudit('account_recovery_granted', actor.sub, request.id, { applicationId: request.applicationId, contactEmail: request.contactEmail, note: request.resolutionNote });
    } else {
      makeAudit('account_recovery_dismissed', actor.sub, request.id, { applicationId: request.applicationId, contactEmail: request.contactEmail, note: request.resolutionNote });
    }
    persist();
    jsonResponse(res, 200, { request: serializeRecovery(request) });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/platform/audit-log') {
    const actor = authenticate(req, res, ['platform_admin']);
    if (!actor) return;
    const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500);
    jsonResponse(res, 200, { entries: auditLog.slice(0, limit), total: auditLog.length });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/minimum-wages') {
    const actor = authenticate(req, res, ['worker', 'ngo_caseworker', 'ngo_admin']);
    if (!actor) return;
    jsonResponse(res, 200, { rates: Array.from(minimumWages.values()).map(serializeWageRate) });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/ngo/minimum-wages') {
    // Phase 31: global reference data is maintained by the platform team only.
    const actor = authenticate(req, res, ['ngo_admin']);
    if (!actor) return;
    jsonResponse(res, 403, { error: 'Minimum wage reference data is now managed by the Pehchaan platform team. Please contact your platform admin to update rates.' });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/worker/schemes') {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    const worker = Array.from(workers.values()).find((item) => item.id === actor.sub);
    if (!worker) {
      jsonResponse(res, 404, { error: 'Worker not found.' });
      return;
    }
    const schemes = getWorkerDashboard(actor.sub).schemes;
    jsonResponse(res, 200, { schemes });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/work-relationships') {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    jsonResponse(res, 200, { relationships: getWorkerDashboard(actor.sub).workRelationships });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/work-relationships') {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    const body = await parseBody(req);
    const label = String(body.label || '').trim();
    if (!label) {
      jsonResponse(res, 400, { error: 'A label is required, for example "Evening delivery gig".' });
      return;
    }
    const relationship = {
      id: randomUUID(),
      workerId: actor.sub,
      label,
      employerName: String(body.employerName || '').trim() || null,
      siteName: String(body.siteName || '').trim() || null,
      category: String(body.category || '').trim() || null,
      startedOn: String(body.startedOn || '').trim() || null,
      endedOn: null,
      active: true,
      createdAt: new Date().toISOString(),
    };
    workRelationships.set(relationship.id, relationship);
    makeAudit('work_relationship_created', actor.sub, relationship.id, { label });
    jsonResponse(res, 201, { relationship });
    return;
  }

  if (req.method === 'PATCH' && pathname.startsWith('/api/work-relationships/')) {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    const body = await parseBody(req);
    const relationship = workRelationships.get(String(pathname.split('/').pop() || ''));
    if (!relationship || relationship.workerId !== actor.sub) {
      jsonResponse(res, 404, { error: 'Work relationship not found.' });
      return;
    }
    if (body.label !== undefined) relationship.label = String(body.label).trim() || relationship.label;
    if (body.employerName !== undefined) relationship.employerName = String(body.employerName).trim() || null;
    if (body.siteName !== undefined) relationship.siteName = String(body.siteName).trim() || null;
    if (body.category !== undefined) relationship.category = String(body.category).trim() || null;
    if (body.startedOn !== undefined) relationship.startedOn = String(body.startedOn).trim() || null;
    if (body.active === false) {
      relationship.active = false;
      relationship.endedOn = new Date().toISOString().slice(0, 10);
    }
    if (body.active === true) {
      relationship.active = true;
      relationship.endedOn = null;
    }
    workRelationships.set(relationship.id, relationship);
    makeAudit('work_relationship_updated', actor.sub, relationship.id, { label: relationship.label, active: relationship.active });
    jsonResponse(res, 200, { relationship });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/worker/trusted-contacts') {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    jsonResponse(res, 200, { contacts: confirmedContacts(actor.sub).concat(Array.from(trustedContacts.values()).filter((item) => item.workerId === actor.sub && item.status === 'pending').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))) });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/worker/trusted-contacts') {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    const body = await parseBody(req);
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    if (!name || !phone) {
      jsonResponse(res, 400, { error: 'Name and phone number are required.' });
      return;
    }
    if (!/^\+?[\d\s-]{7,15}$/.test(phone)) {
      jsonResponse(res, 400, { error: 'Enter a valid phone number.' });
      return;
    }
    const existing = Array.from(trustedContacts.values()).filter((item) => item.workerId === actor.sub && item.status !== 'removed');
    if (existing.length >= maxTrustedContacts) {
      jsonResponse(res, 400, { error: `You can save up to ${maxTrustedContacts} trusted contacts.` });
      return;
    }
    const contact = {
      id: randomUUID(), workerId: actor.sub, name, phone,
      relationshipLabel: String(body.relationshipLabel || '').trim() || null,
      status: 'pending', confirmedAt: null, lastTestSentAt: null,
      createdAt: new Date().toISOString(),
    };
    trustedContacts.set(contact.id, contact);
    makeAudit('trusted_contact_added', actor.sub, contact.id, { name, status: 'pending' });
    persist();
    jsonResponse(res, 201, { contact });
    return;
  }

  if (req.method === 'PATCH' && pathname.startsWith('/api/worker/trusted-contacts/')) {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    const body = await parseBody(req);
    const contactId = pathname.split('/')[4];
    const contact = trustedContacts.get(contactId);
    if (!contact || contact.workerId !== actor.sub || contact.status === 'removed') {
      jsonResponse(res, 404, { error: 'Trusted contact not found.' });
      return;
    }
    if (body.action === 'confirm') {
      contact.status = 'confirmed';
      contact.confirmedAt = new Date().toISOString();
      makeAudit('trusted_contact_confirmed', actor.sub, contact.id, { name: contact.name });
      persist();
      jsonResponse(res, 200, { contact });
      return;
    }
    if (body.action === 'test') {
      try {
        await sendSms(contact.phone, `Pehchaan test alert: This is a sample emergency notification. If a real emergency happens, this number will receive an alert like this. No action is needed now.`);
        contact.lastTestSentAt = new Date().toISOString();
        makeAudit('trusted_contact_test_sent', actor.sub, contact.id, { name: contact.name });
        persist();
        jsonResponse(res, 200, { contact, sent: true });
      } catch (error) {
        jsonResponse(res, 502, { error: error.message || 'Test message could not be sent.' });
      }
      return;
    }
    const name = body.name !== undefined ? String(body.name).trim() : contact.name;
    const phone = body.phone !== undefined ? String(body.phone).trim() : contact.phone;
    if (!name || !phone || !/^\+?[\d\s-]{7,15}$/.test(phone)) {
      jsonResponse(res, 400, { error: 'Name and a valid phone number are required.' });      return;
    }
    contact.name = name;
    contact.phone = phone;
    contact.relationshipLabel = body.relationshipLabel !== undefined ? (String(body.relationshipLabel).trim() || null) : contact.relationshipLabel;
    contact.status = 'pending';
    contact.confirmedAt = null;
    makeAudit('trusted_contact_updated', actor.sub, contact.id, { name, status: 'pending' });
    persist();
    jsonResponse(res, 200, { contact });
    return;
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/worker/trusted-contacts/')) {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    const contactId = pathname.split('/')[4];
    const contact = trustedContacts.get(contactId);
    if (!contact || contact.workerId !== actor.sub) {
      jsonResponse(res, 404, { error: 'Trusted contact not found.' });
      return;
    }
    trustedContacts.delete(contactId);
    makeAudit('trusted_contact_removed', actor.sub, contactId, { name: contact.name });
    persist();
    jsonResponse(res, 204, {});
    return;  }


  if (req.method === 'GET' && pathname === '/api/notifications/vapid-public-key') {
    // The VAPID public key is public by design; the browser needs it to create
    // a push subscription whose key matches the one the server signs with.
    jsonResponse(res, 200, { publicKey: process.env.PUSH_PROVIDER === 'vapid' ? process.env.VAPID_PUBLIC_KEY || null : null });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/notifications') {
    const actor = authenticate(req, res, ['worker', 'ngo_caseworker', 'ngo_admin']);
    if (!actor) return;
    const audienceRole = actor.role === 'worker' ? 'worker' : 'ngo';
    const audience = audienceRole === 'worker'
      ? notifications.filter((item) => item.audienceRole === 'worker' && item.workerId === actor.sub)
      : notifications.filter((item) => item.audienceRole === 'ngo');
    const unread = audience.filter((item) => !item.readAt).length;
    jsonResponse(res, 200, { notifications: audience.slice(0, 50).map(serializeNotification), unread, total: audience.length });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/notifications/read') {
    const actor = authenticate(req, res, ['worker', 'ngo_caseworker', 'ngo_admin']);
    if (!actor) return;
    const audienceRole = actor.role === 'worker' ? 'worker' : 'ngo';
    const body = await parseBody(req);
    const now = new Date().toISOString();
    let changed = 0;
    for (const notification of notifications) {
      if (notification.audienceRole !== audienceRole) continue;
      if (audienceRole === 'worker' && notification.workerId !== actor.sub) continue;
      if (Array.isArray(body.ids) ? body.ids.includes(notification.id) : !notification.readAt) {
        if (!notification.readAt) { notification.readAt = now; changed += 1; }
      }
    }
    if (changed) persist();
    const audience = audienceRole === 'worker'
      ? notifications.filter((item) => item.audienceRole === 'worker' && item.workerId === actor.sub)
      : notifications.filter((item) => item.audienceRole === 'ngo');
    jsonResponse(res, 200, { updated: changed, unread: audience.filter((item) => !item.readAt).length });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/notifications/preferences') {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    jsonResponse(res, 200, { preferences: notificationPreferencesFor(actor.sub) });
    return;
  }

  if (req.method === 'PATCH' && pathname === '/api/notifications/preferences') {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    const body = await parseBody(req);
    const prefs = notificationPreferencesFor(actor.sub);
    for (const key of ['caseUpdates', 'caseNotes', 'wageFlags', 'schemeMatches']) {
      if (typeof body[key] === 'boolean') prefs[key] = body[key];
    }
    persist();
    jsonResponse(res, 200, { preferences: prefs });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/notifications/push-subscribe') {
    const actor = authenticate(req, res, ['worker', 'ngo_caseworker', 'ngo_admin']);
    if (!actor) return;
    const body = await parseBody(req);
    const endpoint = String(body.endpoint || '');
    const p256dh = String(body.keys?.p256dh || body.p256dh || '');
    const auth = String(body.keys?.auth || body.auth || '');
    if (!endpoint || !p256dh || !auth) {
      jsonResponse(res, 400, { error: 'A push subscription endpoint and keys are required.' });
      return;
    }
    const audienceRole = actor.role === 'worker' ? 'worker' : 'ngo';
    const existing = Array.from(pushSubscriptions.values()).find((item) => item.endpoint === endpoint);
    const subscription = existing || { id: randomUUID(), audienceRole, workerId: actor.role === 'worker' ? actor.sub : null, endpoint, p256dh, auth, createdAt: new Date().toISOString() };
    subscription.p256dh = p256dh;
    subscription.auth = auth;
    pushSubscriptions.set(subscription.id, subscription);
    persist();
    jsonResponse(res, 201, { subscribed: true, delivery: process.env.PUSH_PROVIDER === 'vapid' ? 'vapid' : 'in_app_only' });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/notifications/push-unsubscribe') {
    const actor = authenticate(req, res, ['worker', 'ngo_caseworker', 'ngo_admin']);
    if (!actor) return;
    const body = await parseBody(req);
    const endpoint = String(body.endpoint || '');
    for (const [id, subscription] of pushSubscriptions) {
      if (subscription.endpoint === endpoint) pushSubscriptions.delete(id);
    }
    persist();
    jsonResponse(res, 200, { subscribed: false });
    return;
  }
  if (req.method === 'GET' && pathname === '/api/worker/export') {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    if (!checkRateLimit(`export:${actor.sub}`, 5, 15 * 60 * 1000)) {
      jsonResponse(res, 429, { error: 'Too many export requests. Please wait and try again.' });
      return;
    }
    const worker = Array.from(workers.values()).find((item) => item.id === actor.sub);
    if (!worker) {
      jsonResponse(res, 404, { error: 'Worker account not found.' });
      return;
    }
    const exportData = buildWorkerExport(actor.sub, url.searchParams.get('format') || 'json');
    makeAudit('worker_data_exported', actor.sub, actor.sub, { format: exportData.format, formatLabel: exportData.formatLabel });
    if (exportData.format === 'csv') {
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pehchaan-my-data-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Access-Control-Allow-Origin': '*',
      });
      res.end(exportData.body);
      return;
    }
    if (exportData.format === 'pdf') {
      const pdfBuffer = await renderWorkerExportPdf(exportData.data, worker.language);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="pehchaan-my-data-${new Date().toISOString().slice(0, 10)}.pdf"`,
        'Access-Control-Allow-Origin': '*',
      });
      res.end(pdfBuffer);
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="pehchaan-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(exportData.data, null, 2));
    return;
  }

  if (req.method === 'POST' && pathname === '/api/ngo/schemes') {
    // Phase 31: global reference data is maintained by the platform team only.
    const actor = authenticate(req, res, ['ngo_admin']);
    if (!actor) return;
    jsonResponse(res, 403, { error: 'Welfare scheme reference data is now managed by the Pehchaan platform team. Please contact your platform admin to update schemes.' });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/employer/dashboard') {
    const actor = authenticate(req, res, ['employer']);
    if (!actor) return;
    const records = employerWageRecords.filter((record) => record.employerId === actor.sub && record.workerConsent === true).map(({ workerId, workerConsent, ...record }) => record);
    const acknowledged = records.filter((record) => record.status === 'responded').length;
    const flagged = records.filter((record) => record.status === 'disputed').length;
    const responseRate = records.length ? Math.round((acknowledged / records.length) * 100) : 100;
    jsonResponse(res, 200, { records, compliance: { flagged, responded: acknowledged, responseRate, badge: responseRate >= 90 ? 'Responds promptly' : responseRate >= 60 ? 'Responds to flagged issues' : 'Building response record' } });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/employer/worksites') {
    const actor = authenticate(req, res, ['employer']);
    if (!actor) return;
    const body = await parseBody(req);
    const name = String(body.name || '').trim();
    if (!name) { jsonResponse(res, 400, { error: 'Worksite name is required.' }); return; }
    const worksite = { id: randomUUID(), employerId: actor.sub, name, registrationCode: `site-${randomUUID()}`, verified: true, createdAt: new Date().toISOString() };
    worksites.set(worksite.registrationCode, worksite);
    const qrPayload = `${process.env.PUBLIC_APP_URL || 'http://localhost:5173'}/worksite/${worksite.registrationCode}`;
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { errorCorrectionLevel: 'M', margin: 1, width: 280 });
    makeAudit('worksite_qr_created', actor.sub, worksite.id, { name });
    jsonResponse(res, 201, { worksite: { id: worksite.id, name, registrationCode: worksite.registrationCode, verified: true }, qrPayload, qrDataUrl });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/worksites/link') {
    const actor = authenticate(req, res, ['worker']);
    if (!actor) return;
    const body = await parseBody(req);
    const code = String(body.registrationCode || '').trim();
    const worksite = worksites.get(code);
    if (!worksite || !worksite.verified) { jsonResponse(res, 404, { error: 'Verified worksite not found.' }); return; }
    const worker = Array.from(workers.values()).find((item) => item.id === actor.sub);
    if (!worker) { jsonResponse(res, 404, { error: 'Worker not found.' }); return; }
    worker.profile = { ...worker.profile, worksite: worksite.name, worksiteId: worksite.id, worksiteLinkedAt: new Date().toISOString() };
    makeAudit('worksite_linked', actor.sub, worksite.id, { source: 'qr' });
    jsonResponse(res, 200, { worksite: { id: worksite.id, name: worksite.name, verified: true } });
    return;
  }

  if (req.method === 'PATCH' && pathname.startsWith('/api/employer/wage-records/')) {
    const actor = authenticate(req, res, ['employer']);
    if (!actor) return;
    const record = employerWageRecords.find((item) => item.id === pathname.split('/')[4] && item.employerId === actor.sub);
    if (!record) { jsonResponse(res, 404, { error: 'Wage record not found.' }); return; }
    const body = await parseBody(req);
    record.discrepancyResponse = String(body.response || '').trim();
    record.status = 'responded';
    makeAudit('employer_wage_discrepancy_responded', actor.sub, record.id, { response: record.discrepancyResponse });
    jsonResponse(res, 200, { record: { ...record, workerId: undefined, workerConsent: undefined } });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/employer/interest') {
    const body = await parseBody(req);
    const interest = { id: randomUUID(), name: String(body.name || '').trim(), email: String(body.email || '').trim(), organization: String(body.organization || '').trim(), message: String(body.message || '').trim(), createdAt: new Date().toISOString() };
    if (!interest.name || !interest.email || !interest.organization) { jsonResponse(res, 400, { error: 'Name, email, and organization are required.' }); return; }
    employerInterest.push(interest);
    makeAudit('employer_interest_submitted', 'public', interest.id, { organization: interest.organization });
    jsonResponse(res, 201, { submitted: true });
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
      const relationshipId = body.relationshipId ? String(body.relationshipId) : null;
      if (relationshipId) {
        const relationship = workRelationships.get(relationshipId);
        if (!relationship || relationship.workerId !== actor.sub) {
          jsonResponse(res, 400, { error: 'That work relationship does not exist for this account.' });
          return;
        }
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
        relationshipId,
        createdAt: new Date().toISOString(),
      };

      if (!wageEntry.workerId) {
        jsonResponse(res, 400, { error: 'workerId is required.' });
        return;
      }

      wageEntries.push(wageEntry);
      const fairPay = assessWage(Array.from(workers.values()).find((item) => item.id === wageEntry.workerId), wageEntry);
      if (fairPay.status === 'may_be_below_reference') {
        createNotification({ workerId: wageEntry.workerId, type: 'wage_flagged', title: 'Wage entry below the reference rate', body: `₹${wageEntry.amount} looks below the ₹${fairPay.dailyReference}/day reference for ${fairPay.state} · ${fairPay.workerCategory}. You can file a complaint or keep the entry.`, meta: { wageEntryId: wageEntry.id, amount: wageEntry.amount, dailyReference: fairPay.dailyReference } });
      }
      makeAudit('wage_entry_created', wageEntry.workerId, wageEntry.id, wageEntry);
      jsonResponse(res, 201, { wageEntry, fairPay });
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
      const emergency = checkIn.status === 'unsafe' || checkIn.status === 'emergency';
      const alert = emergency ? createSafetyAlert({
        workerId: checkIn.workerId, kind: 'emergency_checkin', location: checkIn.location,
        locationConsent: checkIn.locationConsent, details: { hazard: checkIn.hazard, notes: checkIn.notes },
      }) : null;
      makeAudit('check_in_created', checkIn.workerId, checkIn.id, checkIn);
      jsonResponse(res, 201, { checkIn, ...(alert ? { alert, disclaimer: emergencyDisclaimer, emergencyNumber: '112' } : {}) });
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
      const aiTriage = buildAiTriage(body.summary, { immediateDanger: Boolean(body.immediateDanger), happeningNow: Boolean(body.happeningNow), type: body.type || 'wage_theft' });
      const debtBondage = body.type === 'debt_bondage' ? {
        advanceTaken: Boolean(body.debtBondage?.advanceTaken),
        cannotLeave: Boolean(body.debtBondage?.cannotLeave),
        wagesWithheldForRepayment: Boolean(body.debtBondage?.wagesWithheldForRepayment),
        movementRestricted: Boolean(body.debtBondage?.movementRestricted),
        reportedAt: new Date().toISOString(),
      } : null;
      const caseRelationshipId = body.relationshipId ? String(body.relationshipId) : null;
      if (caseRelationshipId) {
        const relationship = workRelationships.get(caseRelationshipId);
        if (!relationship || relationship.workerId !== actor.sub) {
          jsonResponse(res, 400, { error: 'That work relationship does not exist for this account.' });
          return;
        }
      }
      const newCase = {
        id: `case-${Date.now()}`,
        workerId: String(body.workerId || ''),
        type: body.type || 'wage_theft',
        priority: body.type === 'debt_bondage' ? 'high' : (body.priority || 'medium'),
        immediateDanger: Boolean(body.immediateDanger),
        happeningNow: Boolean(body.happeningNow),
        status: 'new',
        summary: body.summary || '',
        owner: body.owner || null,
        relationshipId: caseRelationshipId,
        debtBondage,
        aiTriage,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!newCase.workerId) {
        jsonResponse(res, 400, { error: 'workerId is required.' });
        return;
      }

      cases.push(newCase);
      notifyNgoCaseworkers({ caseId: newCase.id, type: 'case_assigned', title: 'New case in the inbox', body: `${newCase.id}: ${buildAutoSummary(newCase)}`, meta: { newCase: true, priority: newCase.priority, type: newCase.type } });
      const highRisk = newCase.immediateDanger || newCase.happeningNow || newCase.type === 'debt_bondage';
      const alert = highRisk ? createSafetyAlert({
        caseId: newCase.id, workerId: newCase.workerId, kind: 'high_risk_complaint',
        location: body.location, locationConsent: Boolean(body.locationConsent),
        details: { immediateDanger: newCase.immediateDanger, happeningNow: newCase.happeningNow, debtBondage },
      }) : null;
      makeAudit('case_created', newCase.workerId, newCase.id, { type: newCase.type });
      makeAudit('ai_triage_suggested', 'system:ai-triage', newCase.id, aiTriage);
      const disclaimer = newCase.type === 'debt_bondage' ? `${emergencyDisclaimer} Debt bondage is illegal. Pehchaan organizes and routes this information to trusted organizations; it does not itself rescue or represent the worker.` : emergencyDisclaimer;
      jsonResponse(res, 201, { case: newCase, ...(alert ? { alert, disclaimer, emergencyNumber: '112' } : {}) });
      return;
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || 'Invalid request.' });
      return;
    }
  }

  if (req.method === 'POST' && pathname.startsWith('/api/cases/') && pathname.endsWith('/evidence')) {
    const actor = authenticate(req, res, ['worker', 'ngo_caseworker', 'ngo_admin']);
    if (!actor) return;
    try {
      const caseId = pathname.split('/')[3];
      const targetCase = findCase(caseId);
      if (!targetCase || (actor.role === 'worker' && targetCase.workerId !== actor.sub) || (actor.role !== 'worker' && targetCase.owner !== actor.sub && actor.role !== 'ngo_admin')) {
        jsonResponse(res, 404, { error: 'Case not found.' });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/ngo/alerts') {
        const actor = authenticate(req, res, ['ngo_caseworker', 'ngo_admin']);
        if (!actor) return;
        jsonResponse(res, 200, { alerts: alerts.filter((alert) => actor.role === 'ngo_admin' || !alert.caseId || findCase(alert.caseId)?.owner === actor.sub), total: alerts.length });
        return;
      }

      if (req.method === 'PATCH' && pathname.startsWith('/api/ngo/alerts/')) {
        const actor = authenticate(req, res, ['ngo_caseworker', 'ngo_admin']);
        if (!actor) return;
        const alert = alerts.find((item) => item.id === pathname.split('/')[4]);
        if (!alert) { jsonResponse(res, 404, { error: 'Alert not found.' }); return; }
        const targetCase = alert.caseId && findCase(alert.caseId);
        if (actor.role !== 'ngo_admin' && targetCase?.owner !== actor.sub) { jsonResponse(res, 403, { error: 'This alert is not assigned to you.' }); return; }
        const body = await parseBody(req);
        if (body.action === 'acknowledge') {
          alert.status = 'acknowledged'; alert.acknowledgedAt = new Date().toISOString(); alert.acknowledgedBy = actor.sub; alert.actionTaken = String(body.actionTaken || '').trim() || null;
          for (const notification of notifications) {
            if (notification.type === 'alert_escalated' && notification.meta?.alertId === alert.id && !notification.readAt) notification.readAt = new Date().toISOString();
          }
          makeAudit('alert_acknowledged', actor.sub, alert.caseId || alert.id, { alertId: alert.id, actionTaken: alert.actionTaken });
        } else if (body.action === 'false_alarm') {
          const reason = String(body.reason || '').trim();
          if (!reason) { jsonResponse(res, 400, { error: 'A reason is required to mark a false alarm.' }); return; }
          alert.status = 'false_alarm'; alert.falseAlarmReason = reason;
          makeAudit('alert_marked_false_alarm', actor.sub, alert.caseId || alert.id, { alertId: alert.id, reason });
        }
        jsonResponse(res, 200, { alert });
        return;
      }

      const body = await parseBody(req);
      const mimeType = String(body.mimeType || '');
      const extension = allowedEvidenceTypes.get(mimeType);
      const sizeBytes = Number(body.sizeBytes || 0);
      if (!extension || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxEvidenceBytes) {
        jsonResponse(res, 400, { error: 'Only JPG, PNG, and PDF files up to 10MB are allowed.' });
        return;
      }
      if (evidenceItems.filter((item) => item.caseId === caseId).length >= maxEvidencePerCase) {
        jsonResponse(res, 409, { error: 'This case has reached its evidence limit.' });
        return;
      }
      const evidence = {
        id: randomUUID(),
        caseId,
        type: body.type || extension,
        fileName: body.fileName || 'evidence',
        storageKey: `cases/${caseId}/${randomUUID()}.${extension}`,
        checksum: null,
        uploaderId: actor.sub,
        mimeType,
        sizeBytes,
        consent: { purpose: body.consentPurpose || 'case_support', audience: body.consentAudience || 'assigned_caseworkers' },
        retentionUntil: body.retentionUntil || null,
        scanStatus: 'pending_upload',
        uploadedAt: null,
        available: false,
        createdAt: new Date().toISOString(),
      };
      const signed = await supabaseStorage(`/object/upload/sign/${encodeURIComponent(evidenceBucket)}/${evidence.storageKey}`, 'POST', { upsert: false });
      evidenceItems.push(evidence);
      makeAudit('evidence_upload_url_created', actor.sub, caseId, { evidenceId: evidence.id });
      jsonResponse(res, 201, { evidence, uploadUrl: signed.signedURL || signed.url, token: signed.token || null });
      return;
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || 'Invalid request.' });
      return;
    }

    if (req.method === 'POST' && pathname.match(/^\/api\/cases\/[^/]+\/evidence\/[^/]+\/complete$/)) {
      const actor = authenticate(req, res, ['worker', 'ngo_caseworker', 'ngo_admin']);
      if (!actor) return;
      try {
        const parts = pathname.split('/');
        const caseId = parts[3];
        const evidenceId = parts[5];
        const targetCase = findCase(caseId);
        const evidence = evidenceItems.find((item) => item.id === evidenceId && item.caseId === caseId);
        if (!targetCase || !evidence || !evidenceAccess(actor, targetCase, evidence)) {
          jsonResponse(res, 404, { error: 'Evidence not found.' });
          return;
        }
        const body = await parseBody(req);
        const checksum = String(body.checksum || '').trim();
        if (!/^[a-f0-9]{64}$/i.test(checksum)) {
          jsonResponse(res, 400, { error: 'A SHA-256 checksum is required.' });
          return;
        }
        evidence.checksum = checksum.toLowerCase();
        evidence.uploadedAt = new Date().toISOString();
        evidence.scanStatus = 'pending_scan';
        if (process.env.CLAMAV_URL) {
          const scan = await fetch(process.env.CLAMAV_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bucket: evidenceBucket, key: evidence.storageKey, checksum: evidence.checksum }) });
          if (!scan.ok) throw new Error('Malware scan service is unavailable.');
          const result = await scan.json();
          evidence.scanStatus = result.clean === true ? 'clean' : 'quarantined';
          evidence.available = evidence.scanStatus === 'clean';
        }
        makeAudit('evidence_uploaded', actor.sub, caseId, { evidenceId: evidence.id, scanStatus: evidence.scanStatus });
        jsonResponse(res, 200, { evidence });
      } catch (error) {
        jsonResponse(res, 400, { error: error.message || 'Evidence could not be completed.' });
      }
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/api/evidence/') && pathname.endsWith('/download-url')) {
      const actor = authenticate(req, res, ['worker', 'ngo_caseworker', 'ngo_admin']);
      if (!actor) return;
      const evidenceId = pathname.split('/')[3];
      const evidence = evidenceItems.find((item) => item.id === evidenceId);
      const targetCase = evidence && findCase(evidence.caseId);
      if (!evidence || !targetCase || !evidenceAccess(actor, targetCase, evidence) || !evidence.available || evidence.scanStatus !== 'clean') {
        jsonResponse(res, 404, { error: 'Evidence is not available.' });
        return;
      }
      try {
        const signed = await supabaseStorage(`/object/sign/${encodeURIComponent(evidenceBucket)}`, 'POST', { paths: [evidence.storageKey], expiresIn: 300 });
        const signedUrl = signed?.[0]?.signedURL || signed?.[0]?.signedUrl || signed.signedURL;
        if (!signedUrl) throw new Error('Storage did not return a download URL.');
        jsonResponse(res, 200, { url: signedUrl, expiresIn: 300 });
      } catch (error) {
        jsonResponse(res, 503, { error: error.message || 'Evidence download is unavailable.' });
      }
      return;
    }
  }

  if (req.method === 'GET' && pathname === '/api/ngo/cases') {
    if (!authenticate(req, res, ['ngo_caseworker', 'ngo_admin'])) return;
    jsonResponse(res, 200, { cases: cases.map((item) => ({ ...item, aiSummary: buildAutoSummary(item) })), total: cases.length, auditLog: auditLog.slice(0, 5) });
    return;
  }

  if (req.method === 'POST' && pathname.match(/^\/api\/cases\/[^/]+\/legal-documents$/)) {
    const actor = authenticate(req, res, ['worker', 'ngo_caseworker', 'ngo_admin']);
    if (!actor) return;
    const caseId = pathname.split('/')[3];
    const targetCase = findCase(caseId);
    if (!targetCase || (actor.role === 'worker' && targetCase.workerId !== actor.sub) || (actor.role !== 'worker' && actor.role !== 'ngo_admin' && targetCase.owner !== actor.sub)) {
      jsonResponse(res, 404, { error: 'Case not found.' }); return;
    }
    const body = await parseBody(req);
    const type = body.documentType === 'safety_report' ? 'safety_report' : 'wage_notice';
    const language = body.language === 'hi' ? 'hi' : 'en';
    const content = legalDocumentContent(targetCase, language, type, body.edits || {});
    const document = { id: randomUUID(), caseId, documentType: type, language, content, reviewedBy: actor.role === 'worker' ? null : actor.sub, reviewedAt: actor.role === 'worker' ? null : new Date().toISOString(), createdAt: new Date().toISOString() };
    legalDocuments.set(document.id, document);
    makeAudit('legal_document_generated', actor.sub, caseId, { documentId: document.id, documentType: type, language, reviewed: Boolean(document.reviewedBy) });
    jsonResponse(res, 201, { document: { id: document.id, caseId, documentType: type, language, content, reviewed: Boolean(document.reviewedBy), downloadUrl: `/api/legal-documents/${document.id}/pdf` } });
    return;
  }

  if (req.method === 'GET' && pathname.match(/^\/api\/legal-documents\/[^/]+\/pdf$/)) {
    const actor = authenticate(req, res, ['worker', 'ngo_caseworker', 'ngo_admin']);
    if (!actor) return;
    const document = legalDocuments.get(pathname.split('/')[3]);
    const targetCase = document && findCase(document.caseId);
    if (!document || !targetCase || (actor.role === 'worker' && targetCase.workerId !== actor.sub) || (actor.role !== 'worker' && actor.role !== 'ngo_admin' && targetCase.owner !== actor.sub)) {
      jsonResponse(res, 404, { error: 'Document not found.' }); return;
    }
    if (!document.reviewedBy && actor.role === 'worker') {
      jsonResponse(res, 409, { error: 'This document needs NGO caseworker review before download.' }); return;
    }
    const pdf = await createPdf(document.content, document.language);
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="pehchaan-${document.documentType}-${document.language}.pdf"` });
    res.end(pdf);
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
      aiSummary: buildAutoSummary(targetCase),
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
      const noteCase = findCase(caseId);
      createNotification({ workerId: noteCase?.workerId || null, caseId, type: 'case_note_added', title: 'Your caseworker added a note', body: note.text.slice(0, 160), meta: { noteId: note.id, author: note.author } });
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

  if (req.method === 'GET' && pathname === '/api/ngo/ai-patterns') {
    const actor = authenticate(req, res, ['ngo_admin']);
    if (!actor) return;
    jsonResponse(res, 200, { patterns: employerPatternSignals(), generatedAt: new Date().toISOString() });
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

      const previousStatus = targetCase.status;
      const previousOwner = targetCase.owner;
      targetCase.status = body.status || targetCase.status;
      targetCase.owner = body.owner || targetCase.owner;
      targetCase.priority = body.priority || targetCase.priority;
      if (body.aiDecision === 'accept' || body.aiDecision === 'override') {
        targetCase.aiTriage = { ...targetCase.aiTriage, humanDecision: body.aiDecision, decidedBy: actor.sub, decidedAt: new Date().toISOString(), finalCategory: body.aiDecision === 'accept' ? targetCase.aiTriage?.category : String(body.finalCategory || targetCase.aiTriage?.category || 'Needs review') };
        makeAudit(body.aiDecision === 'accept' ? 'ai_triage_accepted' : 'ai_triage_overridden', actor.sub, caseId, { aiTriage: targetCase.aiTriage });
      }
      targetCase.updatedAt = new Date().toISOString();
      if (targetCase.owner && targetCase.owner !== previousOwner) {
        notifyNgoCaseworkers({ caseId, type: 'case_assigned', title: 'Case assigned', body: `${caseId} was assigned to ${targetCase.owner}.`, meta: { owner: targetCase.owner } });
      }
      if (previousStatus === 'resolved' && targetCase.status !== 'resolved') {
        createNotification({ workerId: targetCase.workerId, caseId, type: 'case_reopened', title: 'Your case was re-opened', body: `Case ${caseId} is ${targetCase.status} again. Your caseworker will follow up.`, meta: { status: targetCase.status } });
      } else if (previousStatus !== targetCase.status) {
        createNotification({ workerId: targetCase.workerId, caseId, type: 'case_status_changed', title: 'Your case status changed', body: `Case ${caseId} is now “${targetCase.status}”.`, meta: { status: targetCase.status, previousStatus } });
      }
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
      alerts.push(alert);
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
      'POST /api/auth/platform-login',
      'POST /api/platform/signup',
      'GET /api/platform/overview',
      'GET /api/platform/applications',
      'POST /api/platform/applications/decision',
      'GET|POST /api/platform/minimum-wages',
      'GET|POST /api/platform/schemes',
      'GET /api/platform/accounts',
      'POST|GET /api/platform/recovery',
      'POST /api/platform/recovery/resolve',
      'GET /api/platform/audit-log',
      'GET /api/notifications/vapid-public-key',
      'GET /api/notifications',
      'POST /api/notifications/read',
      'GET|PATCH /api/notifications/preferences',
      'POST /api/notifications/push-subscribe',
      'POST /api/admin/revoke-account',
    ],
  });
});

async function start() {
  const state = await loadState();
  if (state) {
    for (const row of state.workers) {
      const profile = state.profiles.find((item) => item.worker_id === row.id);
      workers.set(row.phone, {
        id: row.id,
        phone: row.phone,
        role: row.role,
        language: row.language,
        consent: row.consent || {},
        profile: profile?.details || {},
        createdAt: new Date(row.created_at).toISOString(),
      });
    }
    for (const row of state.wages) wageEntries.push({ id: row.id, workerId: row.worker_id, date: new Date(row.entry_date).toISOString(), type: row.entry_type, amount: Number(row.amount), deductions: Number(row.deductions), overtime: Number(row.overtime), proofFileId: row.proof_file_id, relationshipId: row.relationship_id || null, createdAt: new Date(row.created_at).toISOString() });
    for (const row of state.checkins) checkIns.push({ id: row.id, workerId: row.worker_id, status: row.status, hazard: row.hazard, locationConsent: row.location_consent, location: row.location, notes: row.notes, createdAt: new Date(row.created_at).toISOString() });
    for (const row of state.cases) cases.push({ id: row.id, workerId: row.worker_id, type: row.type, priority: row.priority, status: row.status, summary: row.summary, owner: row.owner, immediateDanger: row.immediate_danger, happeningNow: row.happening_now, debtBondage: row.debt_bondage || null, aiTriage: row.ai_triage || buildAiTriage(row.summary, { immediateDanger: row.immediate_danger, happeningNow: row.happening_now, type: row.type }), relationshipId: row.relationship_id || null, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() });
    for (const row of state.notes) caseNotes.push({ id: row.id, caseId: row.case_id, author: row.author, text: row.body, createdAt: new Date(row.created_at).toISOString() });
    for (const row of state.evidence) evidenceItems.push({ id: row.id, caseId: row.case_id, type: row.evidence_type, fileName: row.file_name, storageKey: row.storage_key, checksum: row.checksum, createdAt: new Date(row.created_at).toISOString(), uploaderId: row.uploader_id, mimeType: row.mime_type, sizeBytes: Number(row.size_bytes), consent: row.consent, retentionUntil: row.retention_until, scanStatus: row.scan_status, uploadedAt: row.uploaded_at, available: row.available });
    for (const row of state.audits) auditLog.push({ id: row.id, action: row.action, actor: row.actor, target: row.target, details: row.details, timestamp: new Date(row.created_at).toISOString() });
    for (const row of state.alerts) alerts.push({ id: row.id, caseId: row.case_id, workerId: row.worker_id, kind: row.kind, priority: row.priority, status: row.status, recipient: row.recipient, channel: row.channel, createdAt: new Date(row.created_at).toISOString(), dueAt: row.due_at && new Date(row.due_at).toISOString(), acknowledgedAt: row.acknowledged_at && new Date(row.acknowledged_at).toISOString(), acknowledgedBy: row.acknowledged_by, actionTaken: row.action_taken, falseAlarmReason: row.false_alarm_reason, escalatedAt: row.escalated_at, location: row.location, locationConsent: row.location_consent });
    for (const row of state.otp) otpChallenges.set(row.phone, { workerId: row.worker_id, otpHash: row.otp_hash, expiresAt: new Date(row.expires_at).getTime(), attempts: row.attempts });
    for (const row of state.sessions) sessions.set(row.id, { subject: row.subject, role: row.role, kind: row.kind, createdAt: new Date(row.created_at).getTime() });
    for (const row of state.revoked) revokedAccounts.add(row.account_id);
    for (const row of state.worksites || []) worksites.set(row.registration_code, { id: row.id, employerId: row.employer_id, name: row.name, registrationCode: row.registration_code, verified: row.verified, createdAt: new Date(row.created_at).toISOString() });
    for (const row of state.minimumWages || []) minimumWages.set(`${row.state.toLowerCase()}::${row.worker_category}`, { id: row.id, state: row.state, workerCategory: row.worker_category, dailyAmount: Number(row.daily_amount), currency: row.currency, effectiveFrom: row.effective_from, sourceNote: row.source_note, updatedAt: new Date(row.updated_at).toISOString() });
    for (const row of state.welfareSchemes || []) welfareSchemes.set(row.slug, { id: row.id, slug: row.slug, name: row.name, description: row.description, eligibility: row.eligibility, registrationInstructions: row.registration_instructions, officialUrl: row.official_url, languages: row.languages || {}, states: row.states || ['All India'], workerCategories: row.worker_categories || [], minAge: row.min_age === null ? null : Number(row.min_age), maxAge: row.max_age === null ? null : Number(row.max_age), active: row.active, updatedAt: new Date(row.updated_at).toISOString() });
    for (const row of state.workRelationships || []) workRelationships.set(row.id, { id: row.id, workerId: row.worker_id, label: row.label, employerName: row.employer_name, siteName: row.site_name, category: row.category, startedOn: row.started_on, endedOn: row.ended_on, active: row.active, createdAt: new Date(row.created_at).toISOString() });
    for (const row of state.trustedContacts || []) trustedContacts.set(row.id, { id: row.id, workerId: row.worker_id, name: row.name, phone: row.phone, relationshipLabel: row.relationship_label, status: row.status, confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null, lastTestSentAt: row.last_test_sent_at ? new Date(row.last_test_sent_at).toISOString() : null, createdAt: new Date(row.created_at).toISOString() });
    for (const row of state.platformApplications || []) platformApplications.set(row.id, { id: row.id, kind: row.kind, organizationName: row.organization_name, contactName: row.contact_name, contactEmail: row.contact_email, contactPhone: row.contact_phone, notes: row.notes, status: row.status, rejectionReason: row.rejection_reason, reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null, createdAt: new Date(row.created_at).toISOString() });
    for (const row of state.accountRecovery || []) accountRecovery.set(row.id, { id: row.id, applicationId: row.application_id, contactEmail: row.contact_email, reason: row.reason, status: row.status, resolutionNote: row.resolution_note, requestedBy: row.requested_by, resolvedBy: row.resolved_by, resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null, createdAt: new Date(row.created_at).toISOString() });
    for (const row of state.notifications || []) notifications.push({ id: row.id, audienceRole: row.audience_role, workerId: row.worker_id, caseId: row.case_id, type: row.type, priority: row.priority, title: row.title, body: row.body, meta: row.meta || {}, readAt: row.read_at ? new Date(row.read_at).toISOString() : null, deliveredPushAt: row.delivered_push_at ? new Date(row.delivered_push_at).toISOString() : null, createdAt: new Date(row.created_at).toISOString() });
    for (const row of state.notificationPreferences || []) notificationPreferences.set(row.worker_id, { caseUpdates: row.case_updates, caseNotes: row.case_notes, wageFlags: row.wage_flags, schemeMatches: row.scheme_matches });
    for (const row of state.pushSubscriptions || []) pushSubscriptions.set(row.id, { id: row.id, audienceRole: row.audience_role, workerId: row.worker_id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth, createdAt: new Date(row.created_at).toISOString() });
  }
  stateLoaded = true;
  server.listen(PORT, () => {
    console.log(`Pehchaan Migrate worker MVP listening on http://localhost:${PORT}${databaseConfigured() ? ' (PostgreSQL)' : ''}`);
  });
}

start().catch((error) => {
  console.error('Unable to start Pehchaan API:', error);
  process.exitCode = 1;
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});
