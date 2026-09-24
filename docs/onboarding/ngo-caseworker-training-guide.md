# Pehchaan — NGO Caseworker Training Guide

> **DRAFT — REVIEW BEFORE USE**
> **The NGO staff member who will run caseworker training must review and
> adapt this guide before use** — especially the case-note conventions and
> status definitions, which each organization may want to tune.
>
> Reviewer: ________________  Date: ________________

Audience: NGO caseworkers (daily users) and NGO admins (supervisory).
Duration: one 60-minute session plus shadowing of the first 2–3 live cases.
Format: trainer projects the app, trainees follow on their own laptops/phones.

## Training agenda

| # | Module | Time |
|---|--------|------|
| 1 | Case inbox tour | 10 min |
| 2 | Responding to a high-risk safety alert | 15 min |
| 3 | Case notes and status conventions | 15 min |
| 4 | AI triage, fraud flags, debt-bondage tags | 10 min |
| 5 | Evidence, documents, privacy boundaries | 10 min |

---

## 1. Case inbox tour

The inbox at `/ngo` lists every worker complaint with:

- **Filter tabs:** All / New / High priority / Assigned to me / Flagged.
- **Priority badge** — Urgent / Needs review / Routine. Every complaint arrives
  with an **AI-suggested** category; the final call is always the human's.
- **Red "Flagged for review" badge** — the system found this complaint similar
  to recent ones or spam-like. The case stays open and fully actionable.
- **Debt-bondage tag** — ⚠ marked separately for coordination with labour
  enforcement.
- **Urgent safety alert cards** at the top — red, with an **Acknowledge**
  button (module 2).

Practice: each trainee opens one case and finds the summary, timeline, status
buttons, notes, evidence, and history.

## 2. Responding to a high-risk safety alert

This is the most important module. The escalation system as built:

1. A worker taps HELP (app, WhatsApp `HELP`, SMS `HELP`, USSD help option) or
   files a high-priority report → a **high-priority alert** is created.
2. The alert has a **15-minute acknowledgement window** (due timestamp).
3. If no caseworker acknowledges within 15 minutes, the alert **escalates
   automatically to NGO admins** and stays visible until acknowledged — no
   alert goes unheard.
4. Acknowledging is a **two-field action**: press Acknowledge **and** write
   what action was taken (e.g. "Called worker at 14:32, spoke to them, safe,
   following up tomorrow").

Trainer checklist — every trainee must be able to answer:

- [ ] Where do pending alerts appear? (top of the inbox, red cards)
- [ ] What happens if you don't acknowledge in 15 minutes? (auto-escalation to admin + audit log)
- [ ] What must be filled in when acknowledging? (action taken — specific, timed)
- [ ] What is a **false alarm**? A good-faith safety check-in that turned out
      fine — record it as false alarm with a reason; it is **not** misconduct
      and is handled differently from a fraud report.
- [ ] Escalated alerts also generate an `alert_escalated` notification — where
      do caseworkers see it? (notification bell; it links to the alert and
      marks itself read when the alert is acknowledged)

**Standing rule to teach:** safety escalation is a separate, direct channel —
it is never batched and never delayed by routine notifications. If you see a
red card, stop other work.

## 3. Case notes and status conventions

### Status definitions (teach exactly these meanings)

| Status | Use it when |
|---|---|
| **New** | Complaint received, not yet reviewed by a human |
| **Assigned** | A named caseworker has taken ownership |
| **In progress** | Active work: calls made, site visits, employer contact, coordination |
| **Resolved** | Outcome reached for the worker (payment received, safety fixed, worker withdrew with confirmation, or referred elsewhere with the referral recorded) |

Rules:

- Move **New → Assigned the same day** you first touch a case.
- Never jump New → Resolved. If a complaint is withdrawn or invalid, still
  record the path (assigned → in progress → resolved with a note).
- `resolved` is the only "closed" state — there is no hidden archive.

### Case-note conventions (adjust to your organization, but be consistent)

Structure every note as: **Action. Finding. Next step.** (with dates).

Examples:

- ✅ `14:30 Called worker. Wages ₹1,200 of ₹2,000 paid for the week. Next: employer call 20 May.`
- ❌ `Called. Nothing yet.` (no finding, no next step — unusable if another
  caseworker picks up the case)

Additional conventions:

- One note per contact attempt — do not batch a week of calls into one note.
- Never write sensitive data in notes that does not help the case (full
  personal identifiers beyond what the record already holds).
- Notes are visible to NGO staff on the case — **never to employers or
  workers' co-workers**.
- The four-stage worker timeline (Received → Under review → Action taken →
  Resolved) is derived from these statuses, so accurate statuses directly
  control what the worker sees.

## 4. AI triage, fraud flags, debt-bondage tags

- **AI triage:** every case shows a suggested category with a score. Either
  **Accept suggestion** or pick **Human priority** — both choices are written
  to the audit log. The AI never closes, rejects, or hides a case.
- **Fraud/spam flags:** if you believe a complaint is fraudulent or spam,
  record a fraud report with a reason (spam / duplicate / false_complaint /
  harassment / other). Separately, you can dismiss the system flag as
  "genuine" or confirm it as spam. All of this is logged; the platform team
  sees aggregate patterns (a high dismiss count usually means a real worker
  being wrongly matched).
- **Debt-bondage indicators:** if the case shows advance/loan taken, cannot
  leave until repaid, wages withheld for repayment, or restricted movement —
  tick the indicators in the case panel. These cases often need coordination
  with labour enforcement; flag early.

## 5. Evidence, documents, and privacy boundaries

- **Evidence:** upload JPG/PNG/PDF, max 10 MB, up to 10 files per case. Files
  stay unavailable to you until the malware scan returns clean ("Security scan
  pending" means wait, do not ask the worker to re-upload).
- **Legal documents:** you can generate a **Wage Recovery Notice** or **Safety
  Incident Report** (English or Hindi) from a case. Generation is
  review-first: nothing is sent automatically, and the document carries the
  legal-advice disclaimer.
- **Privacy boundaries (repeat out loud):**
  - You see only the cases assigned to/visible to your organization.
  - Employers see only consented wage records — never complaints, evidence,
    notes, or check-ins.
  - Impact reports and platform oversight contain counts only.
  - Location is never collected on SMS/USSD channels.
- **Worker rights:** workers can export their own data (PDF/CSV/JSON) any time
  and can request deletion — know where this is so you can guide them.

## Shadowing sign-off

After the session, each trainee shadows 2–3 live cases with a senior
caseworker before working alone.

| Trainee | Shadowed cases | Senior caseworker sign-off |
|---|---|---|
| | | |
| | | |
