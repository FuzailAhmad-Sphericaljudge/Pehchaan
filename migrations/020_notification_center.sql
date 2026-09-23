-- Phase 32 Notifications Center: a general, lower-priority notification system
-- that is separate from the Phase 11 safety-escalation channel. Safety alerts
-- keep their own tables and never flow through this queue.

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  audience_role TEXT NOT NULL CHECK (audience_role IN ('worker', 'ngo')),
  worker_id UUID,
  case_id TEXT,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  delivered_push_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_worker_recent_idx ON notifications (worker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (worker_id, read_at) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS notification_preferences (
  worker_id UUID PRIMARY KEY REFERENCES workers(id) ON DELETE CASCADE,
  case_updates BOOLEAN NOT NULL DEFAULT TRUE,
  case_notes BOOLEAN NOT NULL DEFAULT TRUE,
  wage_flags BOOLEAN NOT NULL DEFAULT TRUE,
  scheme_matches BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY,
  audience_role TEXT NOT NULL CHECK (audience_role IN ('worker', 'ngo')),
  worker_id UUID,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_worker_idx ON push_subscriptions (worker_id);
