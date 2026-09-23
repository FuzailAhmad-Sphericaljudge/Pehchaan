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

## Platform super-admin (Phase 31)

A separate **Platform Admin** role (`/platform`) is reserved for the Pehchaan
team itself; no NGO, employer, worker, or partner credential can reach it. Log
in with `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` (demo:
`platform@pehchaan.org` / `demo`). The panel provides:

- **Approval queue** — new NGO and employer applications (public form at
  `/partner-signup`) land as `pending` and cannot log in until a platform admin
  approves them; employer logins for pending/rejected/deactivated accounts are
  rejected server-side. Approving an employer provisions a verified worksite
  QR seed; rejection requires a reason; deactivation immediately signs out and
  blocks the account.
- **Global reference data** — the minimum-wage table (Phase 26) and welfare
  scheme catalog (Phase 27) are managed here in one place. NGO Admin tools are
  read-only now, and every change is attributed in the audit log (who, when,
  old values in details).
- **Platform oversight** — a read-only aggregate view across all NGOs (case
  totals, open/resolved, median resolution time, alert status, channel mix).
  This is operational visibility for the platform team, separate from the
  funder-facing impact analytics of Phase 17, and never exposes case content.
- **Accounts & recovery** — deactivate/reactivate organization accounts and
  handle account recovery requests submitted at `/partner-signup`; recovery is
  never self-service.

Seed approvals live in `migrations/019_platform_admin.sql`.

## Notification center (Phase 32)

Pehchaan now has a general, in-app **notification center** — separate from and
declaredly lower-priority than the Phase 11 safety-escalation channel. Safety
alerts keep their own direct path (`alerts` table, escalation timer, SMS stub)
and never enter the routine notification queue, so routine processing can never
delay an escalation.

- **Bell + unread count** in the worker and NGO side navigation; the panel lists
  case status changes, caseworker notes, fair-pay wage flags (Phase 26), new
  eligible-scheme alerts, and (for NGO staff) case assignments, re-opens, and
  escalated safety alerts. Escalation notifications are delivered immediately
  and mark themselves read when the underlying alert is acknowledged — they
  link to the Phase 11 alert instead of duplicating it.
- **Web push** for the Phase 20 PWA: workers and NGO staff opt in from the bell
  panel's settings. The service worker (`public/sw.js`) shows the notification
  and focuses the app on click. Push is signed with VAPID and relayed via
  `PUSH_API_URL`; without provider config the in-app center remains the channel
  and delivery retries later.
- **Preferences**: workers can switch off case updates, notes, wage checks, and
  scheme matches individually. Safety-related notifications are never
  suppressible. NGO notification types are always on (they are work items).
- Delivery is batched on a 5-second low-priority timer; the safety-alert path is
  untouched and synchronous.

Schema lives in `migrations/020_notification_center.sql` (notifications,
notification_preferences, push_subscriptions). Set `PUSH_PROVIDER=vapid` plus
`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` / `PUSH_API_URL` in
`.env` to enable real browser push; generate keys with
`npx web-push generate-vapid-keys`.

## Minimum wage and fair-pay checker

Worker wage entries are compared with an admin-maintained reference table by
state and worker category. The worker sees a supportive informational message
when an entry may be below the reference and is offered a choice to file a
complaint; no complaint is created automatically. Since Phase 31 the reference
table is managed centrally by the platform team (see above); NGO Admins see a
read-only view from `/ngo/minimum-wages`. Seed
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
Card, old-age pension, and state domestic workers welfare boards) is maintained
centrally by the platform team since Phase 31; NGO Admins see a read-only list
from `/ngo/schemes`. Each scheme entry carries a plain-language description, basic
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
