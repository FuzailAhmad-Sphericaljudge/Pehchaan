CREATE TABLE IF NOT EXISTS welfare_schemes (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  eligibility TEXT NOT NULL,
  registration_instructions TEXT NOT NULL,
  official_url TEXT,
  languages JSONB NOT NULL DEFAULT '{}'::jsonb,
  states TEXT[] NOT NULL DEFAULT ARRAY['All India'],
  worker_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  min_age INTEGER,
  max_age INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO welfare_schemes
  (id, slug, name, description, eligibility, registration_instructions, official_url, states, worker_categories, min_age, max_age)
VALUES
  ('00000000-0000-0000-0000-000000000021', 'e-shram', 'e-Shram registration', 'A national worker database and Universal Account Number that can help workers access welfare services.', 'Informal workers with an Aadhaar-linked mobile number, subject to current government rules.', 'Register through the official e-Shram portal or ask a Common Service Centre for help.', 'https://eshram.gov.in/', ARRAY['All India'], ARRAY[]::TEXT[], 16, 59),
  ('00000000-0000-0000-0000-000000000022', 'pm-sym', 'PM-SYM pension', 'A contributory pension scheme for eligible unorganised workers.', 'Generally for eligible unorganised workers aged 18–40 with income and contribution conditions.', 'Check eligibility and enrol through an official CSC or the PM-SYM portal.', 'https://labour.gov.in/pm-sym', ARRAY['All India'], ARRAY[]::TEXT[], 18, 40),
  ('00000000-0000-0000-0000-000000000023', 'ayushman-bharat', 'Ayushman Bharat', 'Health-cover support for eligible families under the applicable government list.', 'Eligibility depends on the government beneficiary database and current scheme rules.', 'Check eligibility at an official Ayushman Bharat help desk or portal.', 'https://pmjay.gov.in/', ARRAY['All India'], ARRAY[]::TEXT[], NULL, NULL),
  ('00000000-0000-0000-0000-000000000024', 'esic', 'ESIC', 'Health and social-security benefits for workers covered through an eligible employer.', 'Usually applies where the employer and wage conditions bring the worker under ESIC.', 'Ask the employer or nearest ESIC office to confirm coverage and registration.', 'https://www.esic.gov.in/', ARRAY['All India'], ARRAY['factory', 'construction', 'formal_employment'], NULL, NULL)
ON CONFLICT (slug) DO NOTHING;
