CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  phone TEXT PRIMARY KEY,
  worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  language TEXT NOT NULL DEFAULT 'hi',
  state TEXT NOT NULL DEFAULT 'menu',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
