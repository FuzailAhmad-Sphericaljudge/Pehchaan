CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('wage_notice', 'safety_report')),
  language TEXT NOT NULL CHECK (language IN ('en', 'hi')),
  content JSONB NOT NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
