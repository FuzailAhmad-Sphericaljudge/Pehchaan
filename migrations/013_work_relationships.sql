CREATE TABLE IF NOT EXISTS work_relationships (
  id UUID PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  employer_name TEXT,
  site_name TEXT,
  category TEXT,
  started_on DATE,
  ended_on DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE wage_entries ADD COLUMN IF NOT EXISTS relationship_id UUID REFERENCES work_relationships(id);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS relationship_id UUID REFERENCES work_relationships(id);
CREATE INDEX IF NOT EXISTS work_relationships_worker_idx ON work_relationships(worker_id, active);
CREATE INDEX IF NOT EXISTS wage_entries_relationship_idx ON wage_entries(relationship_id);
