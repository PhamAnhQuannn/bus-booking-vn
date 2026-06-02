---
depends-on: [081-charter-request-model, 058-notification-dispatcher-stub]
type: FEATURE
wave: 6
spec: [S16, SYS19]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S16]

## What to build

Wire the **customer charter request flow** to the real backend. Today
`components/contact/ContactBookingForm.tsx` (rendered by `app/lien-he-dat-xe/page.tsx`) is a
client-side success placeholder with no backend; `ContractCarRental.tsx` is a presentational
entry point. Field list already matches the spec — connect it.

- POST route: validate + create a `CharterRequest` (issue 081) in `SUBMITTED` (then
  →ADMIN_REVIEW per the machine). Guest-allowed; logged-in attaches `customerId`. Pickup/
  destinations resolve to `Place` (issue 044). Rate-limit + CSRF + spam guard (required
  contact).
- **Confirmation** (ref + what-happens-next).
- **Status visibility**: a status page (ref-keyed, or in account if logged in) showing
  submitted → under review → matched → confirmed.
- **Cancel-before-accept**: customer can cancel while not yet ACCEPTED.
- **Matched/accepted notification** (issue 058) with operator contact.
- Keep `ContractCarRental.tsx` + `lien-he-dat-xe` as the entry point (connect, don't delete).

## Acceptance criteria

- [ ] Charter form POSTs → creates a CharterRequest (guest or attached) with Place refs.
- [ ] Confirmation shows ref + next steps; route rate-limited + CSRF + spam-guarded.
- [ ] Status page reflects the live state (submitted→under review→matched→confirmed).
- [ ] Customer can cancel before ACCEPTED; cannot after.
- [ ] Match/accept notification with operator contact enqueued.

## Blocked by

- Blocked by `issues/081-charter-request-model.md`,
  `issues/058-notification-dispatcher-stub.md`

## User stories addressed

- [S16] charter request form + confirmation + status + cancel-before-accept + match notify.
