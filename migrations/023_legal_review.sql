-- Phase 35: legal-review sign-off for CMS legal documents.
-- A platform admin records who approved a policy text (and which version);
-- the DRAFT labeling stops while the published version matches the reviewed
-- version. Publishing new text clears the sign-off until re-review.
CREATE TABLE IF NOT EXISTS legal_reviews (
  slug TEXT PRIMARY KEY,
  reviewed_by TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version TEXT NOT NULL
);
