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
