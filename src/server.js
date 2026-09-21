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

function persist() {
  if (!stateLoaded || !databaseConfigured()) return;
  void saveState({ workers, wageEntries, checkIns, cases, caseNotes, evidenceItems, alerts, auditLog, otpChallenges, sessions, revokedAccounts, worksites: Array.from(worksites.values()), legalDocuments: Array.from(legalDocuments.values()), minimumWages: Array.from(minimumWages.values()), welfareSchemes: Array.from(welfareSchemes.values()), workRelationships: Array.from(workRelationships.values()) })
    .catch((error) => console.error('Database persistence failed:', error.message));
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
    cases.push(newCase); makeAudit('case_created', worker.id, newCase.id, { source: 'sms' }); makeAudit('ai_triage_suggested', 'system:ai-triage', newCase.id, newCase.aiTriage); session.state = 'menu'; smsSessions.set(phone, session); smsReply(res, `Case ${newCase.id} created. Reply 5 for status.\\n${smsMenu(session.language)}`); return;
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
    cases.push(newCase); session.state = 'menu'; makeAudit('case_created', worker.id, newCase.id, { source: 'whatsapp' }); makeAudit('ai_triage_suggested', 'system:ai-triage', newCase.id, aiTriage); whatsappSessions.set(phone, session);
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

  function serializeWageRate(rate) {
    return { id: rate.id, state: rate.state, workerCategory: rate.workerCategory, dailyAmount: Number(rate.dailyAmount), currency: rate.currency, effectiveFrom: rate.effectiveFrom, sourceNote: rate.sourceNote, updatedAt: rate.updatedAt };
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
  makeAudit('high_risk_alert_created', workerId, caseId || alert.id, { alertId: alert.id, kind, externalNotification: 'stubbed' });
  return alert;
}

function escalateDueAlerts() {
  const now = Date.now();
  for (const alert of alerts) {
    if (alert.status === 'pending' && !alert.escalatedAt && Date.parse(alert.dueAt) <= now) {
      alert.status = 'escalated';
      alert.escalatedAt = new Date().toISOString();
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

    const adminLogin = body.email === (process.env.NGO_ADMIN_EMAIL || 'admin@pehchaan.org') && body.password === (process.env.NGO_ADMIN_PASSWORD || 'demo');
    const caseworkerLogin = body.email === (process.env.NGO_DEMO_EMAIL || 'ngo@pehchaan.org') && body.password === (process.env.NGO_DEMO_PASSWORD || 'demo');
    if (!adminLogin && !caseworkerLogin) {
      jsonResponse(res, 401, { error: 'Invalid organization credentials.' });
      return;
    }
    const role = adminLogin ? 'ngo_admin' : 'ngo_caseworker';
    const access = issueSession(body.email, role);
    const refresh = issueSession(body.email, role, 'refresh');
    jsonResponse(res, 200, { accessToken: access.token, refreshToken: refresh.token, expiresIn: 900, user: { id: body.email, role } });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/employer-login') {
    const body = await parseBody(req);
    if (body.email !== (process.env.EMPLOYER_DEMO_EMAIL || 'employer@pehchaan.org') || body.password !== (process.env.EMPLOYER_DEMO_PASSWORD || 'demo')) {
      jsonResponse(res, 401, { error: 'Invalid employer credentials.' });
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

  if (req.method === 'GET' && pathname === '/api/minimum-wages') {
    const actor = authenticate(req, res, ['worker', 'ngo_caseworker', 'ngo_admin']);
    if (!actor) return;
    jsonResponse(res, 200, { rates: Array.from(minimumWages.values()).map(serializeWageRate) });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/ngo/minimum-wages') {
    const actor = authenticate(req, res, ['ngo_admin']);
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
    makeAudit('minimum_wage_rate_updated', actor.sub, rate.id, { state, workerCategory, dailyAmount, effectiveFrom });
    jsonResponse(res, 200, { rate: serializeWageRate(rate) });
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

  if (req.method === 'POST' && pathname === '/api/ngo/schemes') {
    const actor = authenticate(req, res, ['ngo_admin']);
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
    makeAudit('welfare_scheme_updated', actor.sub, scheme.id, { slug, active: scheme.active });
    jsonResponse(res, 200, { scheme });
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
      makeAudit('wage_entry_created', wageEntry.workerId, wageEntry.id, wageEntry);
      jsonResponse(res, 201, { wageEntry, fairPay: assessWage(Array.from(workers.values()).find((item) => item.id === wageEntry.workerId), wageEntry) });
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
        priority: body.priority || 'medium',
        immediateDanger: Boolean(body.immediateDanger),
        happeningNow: Boolean(body.happeningNow),
        status: 'new',
        summary: body.summary || '',
        owner: body.owner || null,
        relationshipId: caseRelationshipId,
        aiTriage,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!newCase.workerId) {
        jsonResponse(res, 400, { error: 'workerId is required.' });
        return;
      }

      cases.push(newCase);
      const highRisk = newCase.immediateDanger || newCase.happeningNow;
      const alert = highRisk ? createSafetyAlert({
        caseId: newCase.id, workerId: newCase.workerId, kind: 'high_risk_complaint',
        location: body.location, locationConsent: Boolean(body.locationConsent),
        details: { immediateDanger: newCase.immediateDanger, happeningNow: newCase.happeningNow },
      }) : null;
      makeAudit('case_created', newCase.workerId, newCase.id, { type: newCase.type });
      makeAudit('ai_triage_suggested', 'system:ai-triage', newCase.id, aiTriage);
      jsonResponse(res, 201, { case: newCase, ...(alert ? { alert, disclaimer: emergencyDisclaimer, emergencyNumber: '112' } : {}) });
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

      targetCase.status = body.status || targetCase.status;
      targetCase.owner = body.owner || targetCase.owner;
      targetCase.priority = body.priority || targetCase.priority;
      if (body.aiDecision === 'accept' || body.aiDecision === 'override') {
        targetCase.aiTriage = { ...targetCase.aiTriage, humanDecision: body.aiDecision, decidedBy: actor.sub, decidedAt: new Date().toISOString(), finalCategory: body.aiDecision === 'accept' ? targetCase.aiTriage?.category : String(body.finalCategory || targetCase.aiTriage?.category || 'Needs review') };
        makeAudit(body.aiDecision === 'accept' ? 'ai_triage_accepted' : 'ai_triage_overridden', actor.sub, caseId, { aiTriage: targetCase.aiTriage });
      }
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
    for (const row of state.cases) cases.push({ id: row.id, workerId: row.worker_id, type: row.type, priority: row.priority, status: row.status, summary: row.summary, owner: row.owner, immediateDanger: row.immediate_danger, happeningNow: row.happening_now, aiTriage: row.ai_triage || buildAiTriage(row.summary, { immediateDanger: row.immediate_danger, happeningNow: row.happening_now, type: row.type }), relationshipId: row.relationship_id || null, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() });
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
