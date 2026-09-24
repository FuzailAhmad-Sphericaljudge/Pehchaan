# Pehchaan Legal & Policy Drafts (Phase 35)

> **STATUS: DRAFT — PENDING LEGAL REVIEW**
>
> Every document in this folder is a plain-language draft generated for the
> Pehchaan pilot. None of it is legal advice, and none of it has been reviewed
> by a qualified lawyer. Before launch, a lawyer must review and approve:
>
> - `privacy-policy-draft.md` — the Privacy Policy (EN + HI)
> - `terms-of-use-draft.md` — the Terms of Use (EN + HI)
> - `worker-consent-notice-draft.md` — the on-screen consent text (EN + HI)

## Where this content lives in the product

These drafts are also seeded into the Phase 34 content-management system
(slugs `privacy-policy`, `terms-of-use`, `worker-consent) so the platform
team can edit them without a code deploy. The CMS keeps a version history for
every legal page. **The copy in the CMS is the operative draft; these files
are the review copies for the lawyer.**

After legal review:

1. Apply the lawyer's corrections to the CMS drafts (Super-Admin → Content).
2. Publish each locale from the editor (this stores a new version).
3. Update these files to match and remove the DRAFT banners.
4. Record the review in `docs/launch-checklist.md` (Phase 37) — its Legal
   section (§1) is the formal go/no-go gate for these documents.

## Basis for the drafts

The content is grounded in what the product actually does today:

- **Auth (Phase 8):** phone-number + OTP; no passwords, no email required.
- **Data (Phase 9):** worker profile, wage entries, check-ins, complaints,
  case notes — stored per worker and per case.
- **Evidence (Phase 10):** private storage bucket, malware scanning,
  per-case file limits, retention window.
- **Employer access (Phase 16):** consented wage records only; never
  complaints, evidence, or check-ins.
- **NGO access (Phase 7/11):** assigned cases only; platform staff see
  counts, not case content.
- **Worker rights (Phase 29):** self-service export (PDF/CSV/JSON) and
  deletion request from the profile.

Any change to those systems invalidates the corresponding policy text —
update the CMS drafts (both languages) whenever data practices change.
