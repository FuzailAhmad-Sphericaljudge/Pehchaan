# Pehchaan — Launch Go/No-Go Checklist (Phase 37)

> **STATUS: DRAFT — COMPLETED BY THE TEAM, TOGETHER, OUT LOUD**
> One meeting, one document. Every line is either **checked with evidence**
> (who verified, when, link) or the launch does not happen. The facilitator
> reads every unchecked item out loud before any "go" decision.
>
> Go/No-Go meeting: ____ · Attendees: ________________ · Decision: ☐ GO ☐ NO-GO

## How to use

- Work top to bottom. Each item needs a name and a date — not a vibe.
- Anything unchecked or failed = **NO-GO** for public launch (a staged pilot
  with a smaller scope can still proceed if the team explicitly accepts the
  open risks in the meeting notes).
- This document complements `docs/uat-test-plan.md` (evidence of testing) and
  `docs/legal/README.md` (legal review process).

---

## 1. Legal review sign-off (Phase 35)

The Privacy Policy, Terms of Use, and worker consent notice ship as
**DRAFT — PENDING LEGAL REVIEW** in `docs/legal/` and the CMS. Public launch
requires a qualified lawyer's sign-off — no exceptions.

- [ ] Lawyer reviewed `privacy-policy-draft.md` (EN + HI) — Name: ______ Date: ______
- [ ] Lawyer reviewed `terms-of-use-draft.md` (EN + HI) — Name: ______ Date: ______
- [ ] Lawyer reviewed the on-screen worker consent notice (`worker-consent`) — Name: ______ Date: ______
- [ ] Lawyer's corrections applied to the CMS drafts (Super-Admin → Content)
- [ ] Each locale republished from the editor (version history shows the final text)
- [ ] DRAFT banners removed from `docs/legal/` files and the copies match the CMS
- [ ] Legal-review sign-off recorded in the platform panel for each legal page
      (review pins the published version; label drops while versions match)
- [ ] Data practices re-checked against the policy text: if auth (Phase 8),
      database (9), evidence storage (10), or employer access (16) changed
      since the draft, the corresponding sections were updated and re-reviewed
- [ ] Public version history works: `/privacy-policy` shows what changed and
      when (P8 in the UAT plan passed)

## 2. UAT complete (Phase 37 / this repo)

- [ ] All UAT scenarios executed with recorded Pass/Fail + tester + date
      (`docs/uat-test-plan.md`) — no blank rows
- [ ] All critical defects fixed and re-tested
- [ ] Device matrix filled in on real devices (low-end Android, iOS,
      feature phone for SMS/USSD)
- [ ] Network conditions tested: 2G, intermittent 3G, offline→reconnect
- [ ] Cross-role privacy scenarios (X1–X3) all Pass — data boundaries verified
- [ ] Safety escalation timing verified on a real device (15-minute window,
      auto-escalation, acknowledgement with action taken)

## 3. External service approvals & production config

| Item | Status | Account/reference | Verified by |
|---|---|---|---|
| WhatsApp Business API sender approved | ☐ | | |
| `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_URL` set; provider no longer `stub` | ☐ | | |
| SMS gateway account live (Twilio or equivalent), inbound webhook pointed at `/api/sms/webhook` | ☐ | | |
| USSD route provisioned with the aggregator | ☐ | | |
| Malware scanner service reachable; `CLAMAV_URL` set | ☐ | | |
| Supabase Storage bucket private; service-role key **only** server-side | ☐ | | |
| VAPID keys generated; `PUSH_API_URL` relay configured | ☐ | | |
| SMTP/OTP delivery at production volume tested | ☐ | | |
| NGO helpline number in worker-facing materials confirmed live | ☐ | | |

**Stub check — none of these may ship to public launch:**

- [ ] `SMS_PROVIDER` is not `stub`
- [ ] `WHATSAPP_PROVIDER` is not `stub`
- [ ] OTP codes are not logged or shown in any UI in production

## 4. Production deployment health (Phase 14)

- [ ] PostgreSQL production instance with encrypted backups + point-in-time recovery
- [ ] Multiple backup generations retained; **restore drill performed** (a real
      restore tested, not assumed) — Date of drill: ______
- [ ] Backup credentials separate from application runtime credentials
- [ ] Migrations run against production (`npm run db:migrate`) — current to `023_legal_review.sql`
- [ ] HTTPS enforced; API behind TLS; secrets in environment, never in repo
- [ ] Rate limiting verified in production config (login, OTP, daily abuse caps)
- [ ] Health check / uptime monitoring configured, alerting to a human
- [ ] Error logging captured server-side; log review owner named: ______
- [ ] Service worker cache-busting verified — deploy shows the new UI without hard refresh
- [ ] Load sanity check: expected pilot volume sustained without 5xx
- [ ] Rollback plan written and rehearsed (previous deploy + DB restore point)

## 5. Onboarding readiness (Phase 36)

- [ ] `docs/onboarding/` materials reviewed and adapted by the people who will
      actually run the sessions (reviewer names + dates on each document)
- [ ] Worker onboarding walkthrough rehearsed at least once with a real
      audience (not just internally)
- [ ] NGO caseworker training delivered; shadowing sign-offs recorded
- [ ] Case-note and status conventions agreed by the NGO team and written
      into the training guide
- [ ] Employer explainer reviewed; join funnel tested end-to-end
      (`/partner-signup` → platform approval → portal login → QR creation)
- [ ] Contact placeholders replaced (NGO helpline, employer enquiries)
- [ ] Pilot support rota named: who answers alerts and cases, and when
- [ ] Support/escalation contact path for workers published inside the app
      and on the printed pocket card

## 6. Product guardrails — final confirmation

These are design invariants; re-confirm none regressed before launch:

- [ ] A genuine complaint is never auto-rejected; fraud flags only mark for human review
- [ ] Safety check-ins and the USSD help alert are never rate-limited
- [ ] Employers never see complaints, evidence, check-ins, or notes
- [ ] Impact/oversight reports are aggregate counts only
- [ ] AI triage never closes, rejects, or hides a case
- [ ] Emergency disclaimer visible in worker-facing surfaces: "Pehchaan does
      not replace emergency services, police, courts, or labour departments"
- [ ] Consent gate appears before a worker's first wage entry, check-in, or complaint

## 7. Decision record

| Question | Answer | Evidence/notes |
|---|---|---|
| All Section 1 items checked? | | |
| All Section 2 items checked? | | |
| All Section 3 items checked? | | |
| All Section 4 items checked? | | |
| All Section 5 items checked? | | |
| All Section 6 items checked? | | |
| Open risks explicitly accepted by the team? | | |
| **Decision (GO / NO-GO / GO with limited pilot)** | | |
| Decision owner (name, role) | | |
| Next review date if NO-GO | | |
