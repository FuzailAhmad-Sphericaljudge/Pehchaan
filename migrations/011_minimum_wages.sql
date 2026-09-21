CREATE TABLE IF NOT EXISTS minimum_wage_rates (
  id UUID PRIMARY KEY,
  state TEXT NOT NULL,
  worker_category TEXT NOT NULL,
  daily_amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  effective_from DATE NOT NULL,
  source_note TEXT NOT NULL DEFAULT 'Admin-maintained reference; verify with the latest state notification.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (state, worker_category)
);

INSERT INTO minimum_wage_rates (id, state, worker_category, daily_amount, effective_from)
VALUES
  ('00000000-0000-0000-0000-000000000011', 'Delhi', 'unskilled_construction', 700, '2026-01-01'),
  ('00000000-0000-0000-0000-000000000012', 'Maharashtra', 'unskilled_construction', 550, '2026-01-01'),
  ('00000000-0000-0000-0000-000000000013', 'Tamil Nadu', 'unskilled_construction', 500, '2026-01-01'),
  ('00000000-0000-0000-0000-000000000014', 'West Bengal', 'unskilled_construction', 450, '2026-01-01'),
  ('00000000-0000-0000-0000-000000000015', 'Telangana', 'unskilled_construction', 500, '2026-01-01'),
  ('00000000-0000-0000-0000-000000000016', 'All India', 'unskilled_construction', 400, '2026-01-01')
ON CONFLICT (state, worker_category) DO NOTHING;
