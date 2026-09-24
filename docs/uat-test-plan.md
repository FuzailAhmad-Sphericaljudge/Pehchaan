# Pehchaan — UAT Test Plan & Device/Network Matrix (Phase 37)

> **STATUS: DRAFT — SCAFFOLD FOR HUMAN EXECUTION**
> This plan organizes real-world testing; it does not replace it. Every
> scenario must be executed by a human on a real device and recorded below.
> Scenarios are derived from the features actually built in Phases 6–35 —
> update this document whenever the product changes.
>
> UAT window: ____ to ____ · UAT lead: ________________

## How to use this plan

1. Work through scenarios per role. Record **Pass/Fail/Blocked**, tester name,
   and date on every row — no blank rows at go/no-go time.
2. **Blocked** = could not test (e.g. external service not configured); add
   the reason. Blocked rows are reviewed at go/no-go.
3. Log defects in the tracker with the scenario ID
   (e.g. `UAT-W2: OTP SMS never arrives on Android Go`). Critical = anything
   losing worker data, breaking safety escalation, or leaking data across roles.
4. Test against a staging deployment with the production configuration
   (PostgreSQL, real SMS stub where applicable), never against a developer
   laptop with in-memory data.

## Demo accounts and environment

| Role | Access |
|---|---|
| Worker | Register a fresh phone number (OTP flow); also test the demo worker account |
| NGO Caseworker / Admin | `ngo@pehchaan.org` / `demo` |
| Employer | Demo employer account from the platform approval queue |
| Platform Admin | `platform@pehchaan.org` / `demo` (or `PLATFORM_ADMIN_EMAIL`/`PASSWORD`) |
| Public pages | No login — `/privacy-policy`, `/terms-of-use`, `/faq`, `/join` |

---

## 1. Worker scenarios

| ID | Scenario (phase) | Expected result | Pass/Fail | Tester | Date |
|---|---|---|---|---|---|
| W1 | Register with phone + OTP (8) | OTP arrives; wrong code rejected; account created | | | |
| W2 | 11th failed login attempt from same IP (8) | Blocked with clear message; successful login never counts | | | |
| W3 | App language switch hi/en/bn/ta/te (22) | Whole UI switches; choice persists across reload | | | |
| W4 | First wage entry shows consent gate (35) | Versioned notice shown once; link to full policy works; agree proceeds | | | |
| W5 | Log a wage entry below state minimum wage (26) | Supportive flag message; no complaint auto-created; complaint optional | | | |
| W6 | Daily safety check-in (11) | Check-in saved; reminders/missed-check-in logic visible to NGO only | | | |
| W7 | HELP emergency from app (11) | High-priority alert created; trusted contacts notified; location only with consent | | | |
| W8 | Trusted contacts: add, confirm, test, cap at 5 (16/11) | Contact gets alerts only after confirmation; 6th add refused politely | | | |
| W9 | File a complaint with evidence (10) | JPG/PNG/PDF ≤10 MB, ≤10 files; oversized/wrong type rejected with message | | | |
| W10 | Case timeline view (7) | Four stages shown; NGO notes and evidence never visible to worker | | | |
| W11 | Self-service export PDF/CSV/JSON (29) | All three download; content matches own records | | | |
| W12 | Deletion request from profile (29) | Request recorded; confirmation shown | | | |
| W13 | Notification preferences (32) | Case updates/notes/wage checks/scheme matches individually off; safety alerts never suppressible | | | |
| W14 | Offline: file complaint with no network (20) | Graceful offline behaviour; no silent data loss | | | |
| W15 | Scan employer worksite QR (16) | Verified worksite linked to own profile; no worker data exposed to employer | | | |
| W16 | Scheme matches in profile (27) | "You may be eligible" framing; translated; official link opens | | | |
| W17 | WhatsApp: REGISTER + wage menu (12) | TwiML replies; records appear in app channels | | | |
| W18 | SMS: SAFE / HELP / PAY / COMPLAINT / STATUS (13) | Each keyword works; HELP never rate-limited; no location collected | | | |
| W19 | USSD session menu (13) | CON menu renders on feature phone; END responses correct | | | |
| W20 | 9th new-account attempt from same IP in a day (33) | Refused with message; re-verifying existing account still allowed | | | |

## 2. NGO caseworker scenarios

| ID | Scenario (phase) | Expected result | Pass/Fail | Tester | Date |
|---|---|---|---|---|---|
| N1 | Case inbox filters (6) | All/New/High/Mine/Flagged filters work; search matches case and worker | | | |
| N2 | Accept or override AI triage (7) | Both choices recorded in audit log; final priority is human's | | | |
| N3 | Assign case, change status new→assigned→in_progress→resolved (6) | Status buttons work; worker sees timeline change; notification sent | | | |
| N4 | Add case note (6) | Note saved with author + timestamp; visible to NGO only | | | |
| N5 | Urgent alert: acknowledge within 15 min with action taken (11) | Ack recorded; worker notified; audit written | | | |
| N6 | Urgent alert: no acknowledgement for 15 min (11) | Auto-escalates to NGO admin; `alert_escalated` notification appears; links to alert | | | |
| N7 | Escalated alert: acknowledge (11) | Escalation notification marks itself read; alert leaves the red list | | | |
| N8 | False-alarm handling on a good-faith check-in (11) | Recorded with reason; distinct from fraud reporting | | | |
| N9 | Flagged complaint review: dismiss as genuine / confirm spam (33) | Both dispositions recorded; case remains actionable throughout | | | |
| N10 | Report a false complaint with reason (33) | Fraud report saved with reason + detail; visible to platform aggregate | | | |
| N11 | Debt-bondage indicators on a case (17) | Indicators ticked and stored; tag visible in inbox | | | |
| N12 | Generate wage recovery notice / safety report PDF (EN/HI) (9) | Review-first PDF with disclaimer; nothing sent automatically | | | |
| N13 | Upload evidence to a case (10) | File shows "scan pending" until clean; available after; 11th file rejected | | | |
| N14 | Fraud/spam screening on new complaint (33) | Spam-like text flags `fraudReview`; case still created and notified | | | |

## 3. NGO admin scenarios

| ID | Scenario (phase) | Expected result | Pass/Fail | Tester | Date |
|---|---|---|---|---|---|
| A1 | Minimum wages read-only view (26/31) | Admin can view, cannot edit; platform panel edits reflect | | | |
| A2 | Schemes read-only view (27/31) | Read-only list renders; scheme matches still work for workers | | | |
| A3 | Escalated alerts reach admin (11) | Admin sees unacknowledged escalations | | | |
| A4 | Notification center for staff (32) | Case assignments, re-opens, escalated alerts delivered immediately (work items, always on) | | | |

## 4. Employer scenarios

| ID | Scenario (phase) | Expected result | Pass/Fail | Tester | Date |
|---|---|---|---|---|---|
| E1 | Employer login + portal (16) | Verified employer sees consented wage records only | | | |
| E2 | Access boundary (16) | No complaints, evidence, check-ins, or worker identities anywhere in UI/API | | | |
| E3 | Create worksite QR (16) | QR generated; worker scan links verified worksite | | | |
| E4 | Pending employer login attempt (31) | Rejected server-side with clear message | | | |
| E5 | Aggregate compliance signal only (16) | No public score or penalty view exists | | | |

## 5. Platform admin scenarios

| ID | Scenario (phase) | Expected result | Pass/Fail | Tester | Date |
|---|---|---|---|---|---|
| P1 | Approval queue: approve NGO + employer with verification (31/33) | Approval provisions worksite QR seed; without registration number/domain approval is refused | | | |
| P2 | Reject application with reason (31) | Reason required; rejected account cannot log in | | | |
| P3 | Deactivate organization (31) | Immediate sign-out and login block | | | |
| P4 | Account recovery request lifecycle (31) | Grant resolves; never self-service | | | |
| P5 | Platform oversight view (31) | Aggregate counts only; no case content anywhere | | | |
| P6 | Edit CMS page, preview, publish (34) | Draft→preview→publish; public page updates without deploy | | | |
| P7 | Publish EN, leave HI stale (34) | Stale locales named explicitly after publish | | | |
| P8 | Legal page version history + rollback (34) | Full version list; restore creates new visible version; public `/versions` lists history | | | |
| P9 | Republish identical body (34) | Rejected as no-op with message | | | |
| P10 | Scheme text per-language override (34) | Saved with base entry; blank fields fall back to English; audited | | | |
| P11 | Record legal-review sign-off on published privacy policy (35) | Review recorded; DRAFT label drops; publishing new text clears sign-off | | | |
| P12 | Discard a CMS draft (34) | Draft gone; published body unchanged | | | |
| P13 | Fraud aggregate panel (33) | Reports per account with dismiss counts visible | | | |

## 6. Cross-cutting / privacy scenarios

| ID | Scenario (phase) | Expected result | Pass/Fail | Tester | Date |
|---|---|---|---|---|---|
| X1 | Worker A cannot fetch worker B's records via API (9/16) | 403/404; no data leakage in errors | | | |
| X2 | NGO sees only its own cases (7) | Other NGO cases invisible in UI and API | | | |
| X3 | Impact analytics aggregate-only (17) | No names/phones/evidence/locations in any report | | | |
| X4 | Audit log captures who/when for wage edits, status changes, publishes, approvals (31/34) | Entries present with actor and timestamp | | | |
| X5 | Service worker update flow (20) | Hard-refresh not required after v2+ deploys; navigation network-first | | | |
| X6 | Web push opt-in and delivery (32) | Notification shown with app closed; click focuses app | | | |
| X7 | Speech input + read-aloud per language locale (22) | Correct locale used where the device provides it | | | |

---

## Device & network test matrix (template — fill in as you test)

Per the product's own requirements: the worker audience uses low-end Androids,
patchy 2G/3G networks, and feature phones for the SMS/USSD channels. Test on
real devices; emulators are acceptable only as a pre-check, never as sign-off.

### Devices

| # | Device model | OS / version | RAM tier | Browser/app | Channels tested | Tester | Date | Result / notes |
|---|---|---|---|---|---|---|---|---|
| 1 | | Android Go edition | ≤2 GB | Chrome | App + PWA install | | | |
| 2 | | Android (mid) | 4–6 GB | Chrome | App, push, camera evidence | | | |
| 3 | | iOS | | Safari | App, push, PWA install | | | |
| 4 | | Feature phone | — | — | SMS keywords, USSD menu | | | |
| 5 | | Tablet | | Chrome | App layout | | | |
| 6 | | | | | | | | |

### Network conditions

| # | Condition | How simulated | Scenarios re-run | Tester | Date | Result / notes |
|---|---|---|---|---|---|---|
| 1 | 2G / EDGE (~250 kbps, high latency) | Device setting / throttle | W1, W5, W9, W14 | | | |
| 2 | 3G intermittent (drop every ~30 s) | Throttle + airplane toggles | W4, W9, W14 | | | |
| 3 | Offline → reconnect | Airplane mode | W14, X5 | | | |
| 4 | Wi-Fi → mobile switch | Toggle | W6, W13, X6 | | | |
| 5 | SMS delay / delivery out of order | Carrier reality on test SIMs | W17, W18, W19 | | | |
| 6 | | | | | | |

### Sign-off

| Area | All scenarios passed? (Y/N) | Tester | Date |
|---|---|---|---|
| Worker flows (W1–W20) | | | |
| NGO caseworker (N1–N14) | | | |
| NGO admin (A1–A4) | | | |
| Employer (E1–E5) | | | |
| Platform admin (P1–P13) | | | |
| Cross-cutting & privacy (X1–X7) | | | |
| Device/network matrix rows | | | |
