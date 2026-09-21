ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS ai_triage JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS cases_ai_triage_idx ON cases USING GIN (ai_triage);
