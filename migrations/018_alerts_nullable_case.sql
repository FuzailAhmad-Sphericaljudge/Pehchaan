-- Emergency check-ins create alerts without a case (workerId only),
-- but the original schema required case_id. Relax it and backfill
-- existing rows with a sentinel so the constraint can be dropped.
UPDATE alerts SET case_id = '__no_case__' WHERE case_id IS NULL;
ALTER TABLE alerts ALTER COLUMN case_id DROP NOT NULL;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_case_id_cases_fk;
