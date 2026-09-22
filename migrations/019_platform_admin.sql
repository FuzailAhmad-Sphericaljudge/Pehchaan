CREATE TABLE IF NOT EXISTS platform_applications (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('ngo', 'employer')),
  organization_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL UNIQUE,
  contact_phone TEXT,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'deactivated')),
  rejection_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS account_recovery_requests (
  id UUID PRIMARY KEY,
  application_id UUID REFERENCES platform_applications(id) ON DELETE CASCADE,
  contact_email TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolution_note TEXT,
  requested_by TEXT NOT NULL,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pilot organizations: approved seeds back the demo accounts; pending rows
-- populate the platform approval queue out of the box.
INSERT INTO platform_applications
  (id, kind, organization_name, contact_name, contact_email, notes, status, reviewed_by, reviewed_at)
VALUES
  ('00000000-0000-0000-0000-000000000031', 'ngo', 'Asha Migrant Support', 'Priya Nair', 'admin@pehchaan.org', 'Pilot NGO from the Pehchaan founding team.', 'approved', 'platform-team', now()),
  ('00000000-0000-0000-0000-000000000032', 'ngo', 'Kolkata Labour Collective', 'Demo Caseworker', 'ngo@pehchaan.org', 'Pilot caseworker account for the demo organization.', 'approved', 'platform-team', now()),
  ('00000000-0000-0000-0000-000000000033', 'employer', 'Demo Infrastructure Pvt Ltd', 'Employer Demo', 'employer@pehchaan.org', 'Verified pilot employer.', 'approved', 'platform-team', now()),
  ('00000000-0000-0000-0000-000000000034', 'ngo', 'Nagpur Construction Workers Welfare Society', 'Ravi Deshmukh', 'join@nagpurcwws.example.org', 'Requested access for 6 caseworkers covering construction sites.', 'pending', NULL, NULL),
  ('00000000-0000-0000-0000-000000000035', 'employer', 'Greenleaf Facilities Services', 'Anita Rao', 'anita@greenleaf-facilities.example.com', 'Facilities employer interested in fair-work transparency.', 'pending', NULL, NULL)
ON CONFLICT (id) DO NOTHING;
