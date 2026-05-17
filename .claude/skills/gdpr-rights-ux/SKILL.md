---
name: gdpr-rights-ux
description: GDPR / DSAR rights UI. Access, rectification, erasure, portability, restriction, objection. Identity verification, response SLA, refusal grounds. Outputs `docs/design/gdpr-rights.md` with rights catalog + request flow + verification + audit log + a11y. Pairs with `data-export` (impl). Use when user says "GDPR rights", "DSAR", "subject access request", "right to be forgotten", "data portability", "/gdpr-rights-ux", or before EU launch.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# GDPR Rights UX

## Why you'd care

DSAR requests come in even before you launch in the EU, and a missed one-month deadline is a regulator-visible breach. A documented rights flow + verification + SLA is the only way the support team can actually respond on time.

Six rights, one entry point, audit-grade trail. UI must be findable in ≤2 clicks, identity-verified before any data leaves, response within 30 days, refusal grounds explicit. The hard part is what NOT to delete (legal hold, billing, fraud) and how to explain that without sounding evasive.

## When This Skill Applies

Activate when:
- User says "GDPR rights", "DSAR", "subject access request", "right to be forgotten", "data portability", "/gdpr-rights-ux"
- EU / UK / EEA / CH launch
- Adding new data category that touches PII
- Regulator complaint or DPA inquiry
- Audit existing privacy centre

## Prerequisites

- `docs/compliance/data-export.md` exists (export endpoint = the hands; this is the face).
- PII inventory (`docs/compliance/pii-inventory.md`) — what we hold, where.
- Retention policy (`docs/compliance/retention-policy.md`) — what survives erasure.
- Legal basis matrix per processing activity.
- DPO contact (or "privacy@" if no DPO required).
- `docs/design/consent.md` (consent withdraw flows here).

## Steps

1. **Map rights to UX surfaces.** Each of 6 rights → entry point + flow + outcome.
2. **Single privacy centre.** `/account/privacy` (or `/privacy-center`); one page lists all rights.
3. **Identity verification.** Logged-in users: re-auth (password / magic link). Unauthenticated requesters: email loop + ID-doc only if necessary (data minimisation principle).
4. **Request submission flow.** Choose right → confirm scope → submit → receive request ID + ETA.
5. **Response SLA.** 30 days default; extendable to 90 with reason; clock starts on identity-verified submission.
6. **Refusal grounds.** Manifestly unfounded / excessive / legal-hold / third-party-rights — explicit copy + appeal route.
7. **Audit log.** Every request, every action, who saw it, what was sent. Immutable.
8. **Per-right specifics.** Erasure differs from access differs from portability — separate flows, not one form.
9. **A11y.** Privacy centre fully keyboard navigable; refusal/explanation copy plain-language; no PDF-only outputs.
10. **Write** `docs/design/gdpr-rights.md`.
11. **Auto-chain.** Erasure flow → `/account-deletion-ux`. Export endpoint → `data-export`. Audit trail → `/audit-log-design`. Consent withdraw → `/consent-cookie-ux`.

## Output Format — `docs/design/gdpr-rights.md`

```markdown
---
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
implementation: docs/compliance/data-export.md
pii-inventory: docs/compliance/pii-inventory.md
retention: docs/compliance/retention-policy.md
dpo-contact: privacy@<domain>
sla-default: 30 days
sla-extended: 90 days (with written reason)
---

# GDPR / Privacy Rights

## Rights Catalog (GDPR Art. 15–22)

| Right | Article | What user requests | Default outcome |
|-------|---------|--------------------|-----------------|
| Access | Art. 15 | "What do you hold on me?" | Machine-readable export of all PII |
| Rectification | Art. 16 | "Correct this field" | In-app edit OR support correction + audit entry |
| Erasure ("right to be forgotten") | Art. 17 | "Delete my data" | Hard-delete after 30d cooling-off; legal-hold survives |
| Restriction | Art. 18 | "Stop processing while we sort this out" | Account flagged read-only; processing paused |
| Portability | Art. 20 | "Send to competitor in standard format" | JSON + CSV export, transmissible |
| Objection | Art. 21 | "Stop using my data for X" | Opt-out per processing activity |

(Art. 19 = notification of corrections to recipients; Art. 22 = automated decision-making opt-out — included if applicable.)

## Privacy Centre

Location: `/account/privacy` (logged in) + `/privacy-center` (unauthenticated entry).

Findable from:
- Footer: "Privacy" link.
- Account menu: "Privacy & data".
- Settings sidebar: "Privacy".
- Cookie banner footer: "Manage your data".

Layout:
- Heading: "Your privacy rights".
- Plain-language intro (≤80 words): what rights are, response time, contact.
- Six right-cards, each with: icon + title + 1-line description + "Request" CTA.
- Below: "Request history" table — own past requests with status + ETA + outcome download.
- Sidebar: DPO contact + ICO/CNIL/regulator complaint link + last-updated date of policy.

## Per-Right Flow

### Access (Art. 15) — "Download my data"

1. Click "Request access" → identity re-auth (password or magic-link).
2. Confirmation: "We'll prepare your data. Ready in up to 30 days; usually 24 hours."
3. Email when ready: signed download URL, valid 7 days.
4. Download: ZIP of JSON (machine-readable) + HTML (human-readable) + README.

### Rectification (Art. 16) — "Correct my data"

- For self-editable fields (name, email, address): direct in-app edit; rectification logged.
- For derived / system fields (booking history, payment): "Request correction" form → free-text + supporting evidence upload.
- Response: confirmation of change OR refusal with reason. SLA 30 days.

### Erasure (Art. 17) — "Delete my account and data"

- Routes to `/account/delete` (see `docs/design/account-deletion.md`).
- Soft-delete: account locked + scheduled hard-delete in 30 days (cooling-off).
- Hard-delete: PII purged from primary stores; audit log retained (UID hashed); legal-hold data survives with explicit notice.
- Confirmation email: "Your account is scheduled for deletion on <date>. Cancel by signing in before then."

### Restriction (Art. 18) — "Pause processing"

- Form: select grounds (accuracy disputed / unlawful processing / no longer needed / objection pending).
- Account flagged `restricted`: read-only, no marketing, no profiling, no third-party sharing.
- Notice: "Processing restricted. We'll review and respond within 30 days."

### Portability (Art. 20) — "Send to another service"

- Same export as Access, plus optional direct transfer if recipient publishes a known endpoint (rare; default: download + manual send).
- Format: JSON + CSV, schema documented in README.

### Objection (Art. 21) — "Stop using my data for X"

- Per-purpose opt-out toggles: marketing emails / profiling / analytics / third-party sharing.
- Direct effect; no SLA wait — toggles take effect on save.
- Distinct from consent withdraw (covered in `consent.md`); objection applies to legitimate-interest processing.

## Identity Verification

| Requester | Verification |
|-----------|--------------|
| Logged-in user | Password re-auth OR magic-link re-confirm |
| Unauthenticated, claims account | Email loop to email on file; if email lost, escalate to support with ID-doc (last resort) |
| Third-party (lawyer / parent of minor) | Written authority + ID; manual review |

**Never** ask for ID document when email + account control suffices (data minimisation).

## SLA + Communication

| Stage | When | Channel |
|-------|------|---------|
| Acknowledge | within 24 h of submission | email + in-app |
| Status update | day 14 if not resolved | email |
| Response | within 30 d of identity-verified submission | email + downloadable artifact if relevant |
| Extension notice | before day 30 if extending to 90 | email with written reason |
| Final reply | within 90 d hard cap | email + audit log entry |

In-app status badge per request: `Submitted` → `Verifying` → `In review` → `Completed` / `Refused`.

## Refusal Grounds (with copy)

| Ground | Trigger | Copy template |
|--------|---------|---------------|
| Manifestly unfounded | repeated identical request <30d | "We responded to an identical request on <date>. Resubmit only if circumstances changed." |
| Excessive | repetitive / volume | "This is your <N>th request this month; further requests subject to fee per Art. 12(5)." |
| Third-party rights | data identifies someone else | "Sharing this would reveal information about another person. Redacted version attached." |
| Legal hold / obligation | finance, fraud, regulatory | "We must retain <category> for <duration> under <law>. After then, this data is erased." |
| Freedom of expression | journalism / archive | rare; legal review required |

Every refusal includes:
- Specific ground.
- Plain-language explanation.
- Right to complain to supervisory authority + link.
- Internal appeal route ("Reply to this email to escalate").

## Audit Log

Per request, persist immutably:
- `request_id`, `user_id`, `right_type`, `submitted_at`, `verified_at`.
- `actor` for each action (system / staff member / DPO).
- `actions[]`: timestamp + action + outcome.
- `artifacts_sent[]`: hash + size + recipient + signed-URL expiry.
- `final_status`, `closed_at`, `closed_by`.

Retain ≥6 years (audit standard); contains UID-hash post-erasure (not raw PII).

Log surfaced to user as: in-app history table (own requests) + on request → audit excerpt.

## Staff / Admin Console

Internal-only `/admin/privacy-requests`:
- Inbox of open requests, sorted by SLA deadline.
- Filter by right_type, status, region.
- Per-request view: details + verification check + action buttons (fulfil / refuse / extend).
- Two-staff approval for erasure (one queues, one executes).
- Activity log per request.
- SLA breach alert (red flag at day 25).

## A11y

- Privacy centre fully keyboard navigable; right-cards as buttons or links (not divs with onClick).
- Forms: label per field, error inline + at top, no CAPTCHA-only verification (alternative path required).
- Plain-language copy: target Flesch reading ease ≥60; no jargon ("processing" → "use of your data" first mention).
- Downloadable artifacts: human-readable HTML alongside machine JSON; never PDF-only (less accessible).
- Status badges: text + colour + icon (not colour-only).
- Confirmation modals: focus trap, Esc to cancel, primary CTA explicit ("Yes, delete").

## Multilingual

- Privacy centre + email templates in every supported language.
- Refusal copy: pre-translated, never auto-translated at send time.
- DPO contact + supervisory authority link per region (ICO for UK, CNIL for FR, …).

## Analytics Events (privacy UX itself)

| Event | When | Props |
|-------|------|-------|
| `privacy.center_viewed` | page load | source |
| `privacy.right_initiated` | "Request" clicked | right_type |
| `privacy.identity_verified` | re-auth complete | request_id |
| `privacy.request_submitted` | form submit | request_id, right_type |
| `privacy.request_completed` | staff closes | request_id, outcome |
| `privacy.request_refused` | refusal sent | request_id, ground |

These events are processed under "legitimate interest — compliance audit"; consent banner cannot disable them (compliance > consent for these).

## Out of Scope

- Implementation of export / delete endpoints — see `docs/compliance/data-export.md`.
- Cookie consent flow — see `docs/design/consent.md`.
- Account deletion confirmation flow — see `docs/design/account-deletion.md`.
- AI Act / automated decision opt-out (Art. 22) — separate `ai-act-classifier` skill if applicable.

## Open Questions

- Self-serve vs. ticket-based fulfilment for Access? Default: self-serve for MVP, escalate excessive cases.
- Charge fee for excessive requests (Art. 12(5))? Default: no fee MVP; revisit if >0.1% users abuse.
- Direct portability transfer to known recipients? Defer until a recipient publishes a public ingest endpoint.
```

## Boundaries

- **Identity verified before any data leaves.** No exceptions.
- **30-day SLA, 90-day hard cap.** Clock from verified submission.
- **Refusal always with ground + appeal route.** Never a silent no.
- **Erasure preserves audit log under hashed UID.** Compliance > minimisation here.
- **No CAPTCHA-only verification.** A11y alternative required.
- **No code beyond endpoint shape — impl lives in `data-export`.**

## Re-run Behavior

- Read existing first; surface diff (new right offered, new refusal ground, SLA change).
- Bump `last-updated`.
- Re-run when adding processing activity OR regulator update.

## Auto-chain

- Erasure detail flow → `/account-deletion-ux`.
- Export endpoint → `data-export`.
- Consent withdraw entry → `/consent-cookie-ux`.
- Audit log schema → `/audit-log-design`.
- PII categories → `/pii-inventory-pre`.
- Plain-language copy review → brand-voice-charter if exists.

## Example Trigger

User: "design the privacy centre with all six GDPR rights"
→ Map rights, define entry point + per-right flow + verification + SLA + refusal grounds + audit, write `docs/design/gdpr-rights.md`.
