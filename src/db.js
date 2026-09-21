import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
  : null;

export function databaseConfigured() {
  return Boolean(pool);
}

async function query(text, values = []) {
  if (!pool) return { rows: [], rowCount: 0 };
  return pool.query(text, values);
}

export async function loadState() {
  if (!pool) return null;
  const [workers, profiles, wages, checkins, cases, notes, evidence, alerts, audits, otp, sessions, revoked, worksites, legalDocuments, minimumWages, welfareSchemes, workRelationships, trustedContacts] = await Promise.all([
    query('SELECT * FROM workers'),
    query('SELECT * FROM profiles'),
    query('SELECT * FROM wage_entries'),
    query('SELECT * FROM checkins'),
    query('SELECT * FROM cases'),
    query('SELECT * FROM notes'),
    query('SELECT * FROM evidence'),
    query('SELECT * FROM alerts'),
    query('SELECT * FROM audit_logs ORDER BY created_at DESC'),
    query('SELECT * FROM otp_challenges'),
    query('SELECT * FROM sessions'),
    query('SELECT account_id FROM revoked_accounts'),
    query('SELECT * FROM worksites'),
    query('SELECT * FROM legal_documents'),
    query('SELECT * FROM minimum_wage_rates'),
    query('SELECT * FROM welfare_schemes'),
    query('SELECT * FROM work_relationships'),
    query("SELECT * FROM trusted_contacts WHERE status != 'removed'"),
  ]);
  return { workers: workers.rows, profiles: profiles.rows, wages: wages.rows, checkins: checkins.rows, cases: cases.rows, notes: notes.rows, evidence: evidence.rows, alerts: alerts.rows, audits: audits.rows, otp: otp.rows, sessions: sessions.rows, revoked: revoked.rows, worksites: worksites.rows, legalDocuments: legalDocuments.rows, minimumWages: minimumWages.rows, welfareSchemes: welfareSchemes.rows, workRelationships: workRelationships.rows, trustedContacts: trustedContacts.rows };
}

export async function saveState(state) {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const worker of state.workers.values()) {
      await client.query(
        `INSERT INTO workers (id, phone, role, language, consent, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET phone=$2, language=$4, consent=$5`,
        [worker.id, worker.phone, worker.role, worker.language, worker.consent, worker.createdAt],
      );
      await client.query(
        `INSERT INTO profiles (worker_id, details) VALUES ($1,$2)
         ON CONFLICT (worker_id) DO UPDATE SET details=$2, updated_at=now()`,
        [worker.id, worker.profile],
      );
    }
    for (const entry of state.wageEntries) {
      await client.query(
        `INSERT INTO wage_entries (id, worker_id, entry_date, entry_type, amount, deductions, overtime, proof_file_id, relationship_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
        [entry.id, entry.workerId, entry.date, entry.type, entry.amount, entry.deductions, entry.overtime, entry.proofFileId, entry.relationshipId, entry.createdAt],
      );
    }
    for (const item of state.checkIns) {
      await client.query(
        `INSERT INTO checkins (id, worker_id, status, hazard, location_consent, location, notes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [item.id, item.workerId, item.status, item.hazard, item.locationConsent, item.location, item.notes, item.createdAt],
      );
    }
    for (const item of state.cases) {
      await client.query(
        `INSERT INTO cases (id, worker_id, type, priority, status, summary, owner, immediate_danger, happening_now, ai_triage, relationship_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO UPDATE SET priority=$4,status=$5,summary=$6,owner=$7,immediate_danger=$8,happening_now=$9,ai_triage=$10,relationship_id=$11,updated_at=$13`,
        [item.id, item.workerId, item.type, item.priority, item.status, item.summary, item.owner, item.immediateDanger, item.happeningNow, item.aiTriage || {}, item.relationshipId, item.createdAt, item.updatedAt],
      );
    }
    for (const item of state.caseNotes) {
      await client.query('INSERT INTO notes (id, case_id, author, body, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING', [item.id, item.caseId, item.author, item.text, item.createdAt]);
    }
    for (const item of state.evidenceItems) {
      await client.query(`INSERT INTO evidence (id, case_id, evidence_type, file_name, storage_key, checksum, created_at, uploader_id, mime_type, size_bytes, consent, retention_until, scan_status, uploaded_at, available)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO UPDATE SET checksum=$6,uploaded_at=$14,scan_status=$13,available=$15`,
        [item.id, item.caseId, item.type, item.fileName, item.storageKey, item.checksum, item.createdAt, item.uploaderId, item.mimeType, item.sizeBytes, item.consent, item.retentionUntil, item.scanStatus, item.uploadedAt, item.available]);
    }
    for (const item of state.alerts) {
      await client.query(`INSERT INTO alerts (id, case_id, worker_id, kind, priority, channel, recipient, status, acknowledged_at, acknowledged_by, action_taken, false_alarm_reason, escalated_at, due_at, location, location_consent, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (id) DO UPDATE SET status=$8,acknowledged_at=$9,acknowledged_by=$10,action_taken=$11,false_alarm_reason=$12,escalated_at=$13`,
        [item.id, item.caseId, item.workerId, item.kind, item.priority, item.channel, item.recipient, item.status, item.acknowledgedAt, item.acknowledgedBy, item.actionTaken, item.falseAlarmReason, item.escalatedAt, item.dueAt, item.location, item.locationConsent, item.createdAt]);
    }
    for (const item of state.auditLog) {
      await client.query('INSERT INTO audit_logs (id, action, actor, target, details, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING', [item.id, item.action, item.actor, item.target, item.details, item.timestamp]);
    }
    for (const [phone, challenge] of state.otpChallenges) {
      await client.query(
        `INSERT INTO otp_challenges (phone, worker_id, otp_hash, expires_at, attempts)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (phone) DO UPDATE SET otp_hash=$3,expires_at=$4,attempts=$5`,
        [phone, challenge.workerId, challenge.otpHash, new Date(challenge.expiresAt), challenge.attempts],
      );
    }
    for (const [id, session] of state.sessions) {
      await client.query('INSERT INTO sessions (id, subject, role, kind) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING', [id, session.subject, session.role, session.kind]);
    }
    for (const accountId of state.revokedAccounts) {
      await client.query('INSERT INTO revoked_accounts (account_id) VALUES ($1) ON CONFLICT (account_id) DO NOTHING', [accountId]);
    }
    for (const item of state.worksites || []) {
      await client.query('INSERT INTO worksites (id, employer_id, name, registration_code, verified, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING', [item.id, item.employerId, item.name, item.registrationCode, item.verified, item.createdAt]);
    }
    for (const item of state.legalDocuments || []) {
      await client.query('INSERT INTO legal_documents (id, case_id, document_type, language, content, reviewed_by, reviewed_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET content=$5,reviewed_by=$6,reviewed_at=$7', [item.id, item.caseId, item.documentType, item.language, item.content, item.reviewedBy, item.reviewedAt, item.createdAt]);
    }
    for (const item of state.minimumWages || []) {
      await client.query('INSERT INTO minimum_wage_rates (id, state, worker_category, daily_amount, currency, effective_from, source_note, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (state, worker_category) DO UPDATE SET daily_amount=$4,currency=$5,effective_from=$6,source_note=$7,updated_at=$8', [item.id, item.state, item.workerCategory, item.dailyAmount, item.currency, item.effectiveFrom, item.sourceNote, item.updatedAt]);
    }
    for (const item of state.workRelationships || []) {
      await client.query(`INSERT INTO work_relationships (id, worker_id, label, employer_name, site_name, category, started_on, ended_on, active, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO UPDATE SET label=$3,employer_name=$4,site_name=$5,category=$6,started_on=$7,ended_on=$8,active=$9`,
        [item.id, item.workerId, item.label, item.employerName, item.siteName, item.category, item.startedOn, item.endedOn, item.active, item.createdAt]);
    }
    for (const item of state.trustedContacts || []) {
      await client.query(`INSERT INTO trusted_contacts (id, worker_id, name, phone, relationship_label, status, confirmed_at, last_test_sent_at, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO UPDATE SET name=$3, phone=$4, relationship_label=$5, status=$6, confirmed_at=$7, last_test_sent_at=$8, updated_at=$10`,
        [item.id, item.workerId, item.name, item.phone, item.relationshipLabel || null, item.status, item.confirmedAt ? new Date(item.confirmedAt) : null, item.lastTestSentAt ? new Date(item.lastTestSentAt) : null, item.createdAt, new Date()]);
    }
    for (const item of state.welfareSchemes || []) {
      await client.query(`INSERT INTO welfare_schemes (id, slug, name, description, eligibility, registration_instructions, official_url, languages, states, worker_categories, min_age, max_age, active, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (id) DO UPDATE SET name=$3,description=$4,eligibility=$5,registration_instructions=$6,official_url=$7,languages=$8,states=$9,worker_categories=$10,min_age=$11,max_age=$12,active=$13,updated_at=$14`,
        [item.id, item.slug, item.name, item.description, item.eligibility, item.registrationInstructions, item.officialUrl, item.languages || {}, item.states, item.workerCategories, item.minAge, item.maxAge, item.active, item.updatedAt]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  if (pool) await pool.end();
}
