-- Phase 33 Fraud & Abuse Prevention: everything here is flag-for-human-review
-- oriented. Nothing in this schema auto-rejects a worker complaint; the fraud
-- report log is separate from the Phase 11 safety false-alarm handling so
-- good-faith safety check-ins are never conflated with bad-faith abuse.

CREATE TABLE IF NOT EXISTS fraud_reports (
  id UUID PRIMARY KEY,
  case_id TEXT NOT NULL,
  worker_id UUID,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'duplicate', 'false_complaint', 'harassment', 'other')),
  detail TEXT NOT NULL DEFAULT '',
  reported_by TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fraud_reports_worker_idx ON fraud_reports (worker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fraud_reports_case_idx ON fraud_reports (case_id);

ALTER TABLE platform_applications
  ADD COLUMN IF NOT EXISTS registration_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS official_domain TEXT NOT NULL DEFAULT '';

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS fraud_review JSONB NOT NULL DEFAULT '{}'::jsonb;
