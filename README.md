# Pehchaan

## Local development

Install dependencies with `npm install`. Start the API with `npm run dev:api`
and the Vite frontend with `npm run dev`.

### Troubleshooting

- **"Could not reach the server" on login** — the API server is not running.
  Start it with `npm run dev:api` (it listens on port 5000; the Vite dev
  server proxies `/api` to it).
- **"Too many login attempts"** — login rate limiting allows 10 failed
  attempts per IP every 15 minutes. Successful logins never count against
  the limit. Restarting the API clears the in-memory buckets.
- **Old UI after an update** — the service worker caches the app shell.
  Hard-refresh once (Ctrl+Shift+R); from v2 onward page navigations are
  network-first, so later deploys appear without a manual refresh.

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

## SMS / USSD fallback

Feature-phone channels are available through `POST /api/sms/webhook` and
`POST /api/ussd`. SMS accepts `SAFE`, `HELP`, `PAY`, `COMPLAINT`, and `STATUS`
or numbered replies; USSD returns a short `CON` menu and `END` responses.
Local development uses `SMS_PROVIDER=stub`. For production, configure a
gateway such as Twilio SMS and point its inbound SMS webhook at the SMS route.
Every SMS/USSD action creates the same wage, check-in, case, alert, and audit
records as the app channels. Location is never collected by these fallback
channels.

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

## Minimum wage and fair-pay checker

Worker wage entries are compared with an admin-maintained reference table by
state and worker category. The worker sees a supportive informational message
when an entry may be below the reference and is offered a choice to file a
complaint; no complaint is created automatically. NGO Admins can update rates
from `/ngo/minimum-wages`, including an effective date and source note. Seed
rates are illustrative references and must be checked against the latest state
notifications before production use.

## Schemes for you (welfare scheme awareness)

The worker app surfaces relevant government welfare schemes for informal and
migrant workers based on simple profile attributes: state, age, and work
category. Workers add these in "My profile"; matching is informational only —
results are framed as "You may be eligible", never a guarantee, and Pehchaan
does not submit applications on a worker's behalf.

The reference catalog (e-Shram, PM-SYM, Ayushman Bharat, ESIC, PM SVANidhi,
BOCW construction workers welfare board, PM Awas Yojana, One Nation One Ration
Card, old-age pension, and state domestic workers welfare boards) is
admin-editable by NGO Admins from `/ngo/schemes`, like the Phase 26 wage
table. Each scheme entry carries a plain-language description, basic
eligibility, registration instructions, and an official portal link where one
exists. Scheme names, descriptions, eligibility, and instructions are
translated in Hindi, Bengali, Tamil, and Telugu through the same translation
layer as the rest of the app, so language does not gatekeep scheme awareness.
Seed content is illustrative and must be verified against the latest official
sources before production use.

## Secure evidence storage

Evidence uses a private Supabase Storage bucket. Set `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_EVIDENCE_BUCKET`; never expose the
service-role key to the browser. The API issues short-lived signed upload and
download URLs, accepts only JPG/PNG/PDF files up to 10MB, and limits each case
to ten files. Upload completion requires a SHA-256 checksum. Configure
`CLAMAV_URL` with the malware-scanning service endpoint; files remain
unavailable until the scanner returns `clean`.
