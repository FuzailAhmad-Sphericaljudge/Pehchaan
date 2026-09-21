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

## WhatsApp bot

The guided bot is available at `POST /api/whatsapp/webhook` and returns TwiML
messages for Twilio WhatsApp webhooks. It supports `REGISTER`, numbered menu
actions for wages, safety, complaints, case status, language selection, and a
link back to the full app. WhatsApp-originated records and audit events use the
same worker/case/check-in flows as the app. Set `WHATSAPP_VERIFY_TOKEN` and
`WHATSAPP_APP_URL`; leave `WHATSAPP_PROVIDER=stub` for local webhook testing.
For outbound provider messages, configure the Twilio WhatsApp variables only
after a WhatsApp Business sender has been approved.

## AI-assisted triage

New complaints receive a transparent, rules-based AI suggestion (`Urgent`,
`Needs review`, or `Routine`) using explicit danger flags, complaint type, and
matching safety/wage terms. The suggestion is never used to close, reject, or
hide a case. NGO caseworkers can accept it or choose a different category;
both actions are written to the audit log. NGO Admins also receive an
aggregate employer/site pattern signal when at least two independent workers
reference the same profile employer/worksite. This signal is investigative
only and does not publish or penalize an employer.

## Regional languages

The worker-facing translation system supports Hindi, English, Bengali, Tamil,
and Telugu through the language picker. Browser speech recognition and
read-aloud use the matching `hi-IN`, `en-IN`, `bn-IN`, `ta-IN`, or `te-IN`
locale when the device provides it. The WhatsApp demo menu accepts `LANG HI`,
`LANG EN`, `LANG BN`, `LANG TA`, and `LANG TE`.

Regional UI strings are marked for native-speaker review before production
rollout. Free-text complaint descriptions are intentionally not machine
translated in this phase.

## Trust and transparency

Verified employer accounts can create worksite QR codes from the employer
portal. A logged-in worker scanning a QR links that verified worksite to their
own profile; the link is then available to wage and complaint records without
exposing worker data publicly. Employer compliance is shown only as an
aggregate response signal. Workers see a simple four-stage timeline for their
own cases, while NGO notes and evidence remain private.

## Legal aid documents

NGO caseworkers can generate a wage recovery notice or safety incident report
from a case in English or Hindi. The document is created as a PDF with a
plain-language explanation, structured case fields, evidence references, and
the legal-advice disclaimer. Generation is review-first: worker-created
previews cannot be downloaded until an NGO caseworker or admin has reviewed
the document, and no document is sent automatically.

## Secure evidence storage

Evidence uses a private Supabase Storage bucket. Set `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_EVIDENCE_BUCKET`; never expose the
service-role key to the browser. The API issues short-lived signed upload and
download URLs, accepts only JPG/PNG/PDF files up to 10MB, and limits each case
to ten files. Upload completion requires a SHA-256 checksum. Configure
`CLAMAV_URL` with the malware-scanning service endpoint; files remain
unavailable until the scanner returns `clean`.
