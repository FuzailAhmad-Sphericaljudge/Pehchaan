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
  const [workers, profiles, wages, checkins, cases, notes, evidence, alerts, audits, otp, sessions, revoked] = await Promise.all([
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
  ]);
  return { workers: workers.rows, profiles: profiles.rows, wages: wages.rows, checkins: checkins.rows, cases: cases.rows, notes: notes.rows, evidence: evidence.rows, alerts: alerts.rows, audits: audits.rows, otp: otp.rows, sessions: sessions.rows, revoked: revoked.rows };
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
        `INSERT INTO wage_entries (id, worker_id, entry_date, entry_type, amount, deductions, overtime, proof_file_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [entry.id, entry.workerId, entry.date, entry.type, entry.amount, entry.deductions, entry.overtime, entry.proofFileId, entry.createdAt],
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
        `INSERT INTO cases (id, worker_id, type, priority, status, summary, owner, immediate_danger, happening_now, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET priority=$4,status=$5,summary=$6,owner=$7,immediate_danger=$8,happening_now=$9,updated_at=$11`,
        [item.id, item.workerId, item.type, item.priority, item.status, item.summary, item.owner, item.immediateDanger, item.happeningNow, item.createdAt, item.updatedAt],
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
