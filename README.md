# Pehchaan

## Local development

Install dependencies with `npm install`. Start the API with `npm run dev:api`
and the Vite frontend with `npm run dev`.

## PostgreSQL persistence

Phase 9 uses PostgreSQL (including Supabase PostgreSQL) through `pg`.
Set `DATABASE_URL` in the environment to the connection string supplied by
your local PostgreSQL instance or Supabase project, then run:

```bash
npm run db:migrate
```

Migrations are tracked in `migrations/` and can be safely run repeatedly.
The database contains worker identity/profile data, wages, check-ins, cases,
notes, evidence metadata, alerts, audit logs, OTP challenges, sessions, and
account revocations. Do not commit `.env` or connection strings.

For production, use encrypted managed PostgreSQL backups with point-in-time
recovery where available, retain multiple backup generations, and perform
periodic restore drills. Backup credentials should be kept separate from the
application runtime credentials.

## Secure evidence storage

Evidence uses a private Supabase Storage bucket. Set `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_EVIDENCE_BUCKET`; never expose the
service-role key to the browser. The API issues short-lived signed upload and
download URLs, accepts only JPG/PNG/PDF files up to 10MB, and limits each case
to ten files. Upload completion requires a SHA-256 checksum. Configure
`CLAMAV_URL` with the malware-scanning service endpoint; files remain
unavailable until the scanner returns `clean`.
