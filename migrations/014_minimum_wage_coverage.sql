-- Expands the Phase 26 fair-pay reference dataset. Seed values are illustrative
-- references only; NGO Admins must verify each rate against the latest official
-- state notification before relying on it. Rates are per day, in INR.
INSERT INTO minimum_wage_rates (id, state, worker_category, daily_amount, effective_from, source_note)
VALUES
  -- Semi-skilled construction
  ('00000000-0000-0000-0000-000000000031', 'Delhi', 'semi_skilled_construction', 780, '2026-01-01', 'Illustrative reference; verify with the latest Delhi government notification.'),
  ('00000000-0000-0000-0000-000000000032', 'Maharashtra', 'semi_skilled_construction', 620, '2026-01-01', 'Illustrative reference; verify with the latest Maharashtra government notification.'),
  ('00000000-0000-0000-0000-000000000033', 'Tamil Nadu', 'semi_skilled_construction', 560, '2026-01-01', 'Illustrative reference; verify with the latest Tamil Nadu government notification.'),
  ('00000000-0000-0000-0000-000000000034', 'West Bengal', 'semi_skilled_construction', 510, '2026-01-01', 'Illustrative reference; verify with the latest West Bengal government notification.'),
  ('00000000-0000-0000-0000-000000000035', 'Telangana', 'semi_skilled_construction', 560, '2026-01-01', 'Illustrative reference; verify with the latest Telangana government notification.'),
  ('00000000-0000-0000-0000-000000000036', 'All India', 'semi_skilled_construction', 480, '2026-01-01', 'Illustrative national fallback reference; verify with the latest state notification.'),

  -- Skilled construction
  ('00000000-0000-0000-0000-000000000041', 'Delhi', 'skilled_construction', 900, '2026-01-01', 'Illustrative reference; verify with the latest Delhi government notification.'),
  ('00000000-0000-0000-0000-000000000042', 'Maharashtra', 'skilled_construction', 720, '2026-01-01', 'Illustrative reference; verify with the latest Maharashtra government notification.'),
  ('00000000-0000-0000-0000-000000000043', 'Tamil Nadu', 'skilled_construction', 650, '2026-01-01', 'Illustrative reference; verify with the latest Tamil Nadu government notification.'),
  ('00000000-0000-0000-0000-000000000044', 'West Bengal', 'skilled_construction', 600, '2026-01-01', 'Illustrative reference; verify with the latest West Bengal government notification.'),
  ('00000000-0000-0000-0000-000000000045', 'Telangana', 'skilled_construction', 650, '2026-01-01', 'Illustrative reference; verify with the latest Telangana government notification.'),
  ('00000000-0000-0000-0000-000000000046', 'All India', 'skilled_construction', 560, '2026-01-01', 'Illustrative national fallback reference; verify with the latest state notification.'),

  -- Domestic work
  ('00000000-0000-0000-0000-000000000051', 'Delhi', 'domestic_work', 550, '2026-01-01', 'Illustrative reference; verify with the latest Delhi government notification.'),
  ('00000000-0000-0000-0000-000000000052', 'Maharashtra', 'domestic_work', 480, '2026-01-01', 'Illustrative reference; verify with the latest Maharashtra government notification.'),
  ('00000000-0000-0000-0000-000000000053', 'Tamil Nadu', 'domestic_work', 440, '2026-01-01', 'Illustrative reference; verify with the latest Tamil Nadu government notification.'),
  ('00000000-0000-0000-0000-000000000054', 'West Bengal', 'domestic_work', 400, '2026-01-01', 'Illustrative reference; verify with the latest West Bengal government notification.'),
  ('00000000-0000-0000-0000-000000000055', 'Telangana', 'domestic_work', 440, '2026-01-01', 'Illustrative reference; verify with the latest Telangana government notification.'),
  ('00000000-0000-0000-0000-000000000056', 'All India', 'domestic_work', 380, '2026-01-01', 'Illustrative national fallback reference; verify with the latest state notification.')
ON CONFLICT (state, worker_category) DO NOTHING;
