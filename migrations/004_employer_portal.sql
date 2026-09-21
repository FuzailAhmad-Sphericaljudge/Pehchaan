CREATE TABLE IF NOT EXISTS employers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS employment_links (
  id UUID PRIMARY KEY,
  employer_id TEXT NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  consented_at TIMESTAMPTZ NOT NULL,
  UNIQUE (employer_id, worker_id)
);
CREATE TABLE IF NOT EXISTS employer_wage_records (
  id UUID PRIMARY KEY,
  employer_id TEXT NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  promised_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'posted',
  discrepancy_response TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS employer_interest (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employer_wage_records_employer_idx ON employer_wage_records(employer_id);
