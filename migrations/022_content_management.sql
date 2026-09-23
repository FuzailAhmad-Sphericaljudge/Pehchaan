-- Phase 34 Content Management: database-backed content for legal and static
-- pages so Privacy Policy, Terms of Use, FAQ, and mission text can be updated
-- by the platform team without a code deploy. content_versions is append-only
-- by convention: every publish adds a row and legal pages never delete theirs,
-- so the team can show exactly what a policy said on any given date.

CREATE TABLE IF NOT EXISTS content_pages (
  slug TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'static',
  locales JSONB NOT NULL DEFAULT '{}'::jsonb,
  drafts JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS content_versions (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'static',
  locale TEXT NOT NULL,
  body TEXT NOT NULL,
  published_by TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_versions_slug_idx ON content_versions (slug, created_at DESC);
