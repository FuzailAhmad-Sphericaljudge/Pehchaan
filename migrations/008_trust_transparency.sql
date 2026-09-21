CREATE TABLE IF NOT EXISTS worksites (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  registration_code TEXT NOT NULL UNIQUE,
  verified BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
