---
depends-on: [042-add-booking-buyer-email]
type: FEATURE
wave: 7
spec: [S03, SYS13, S04]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S03] / [SYS13]

## What to build

**Consent capture** at checkout — no-refund consent + PII-storage consent. Today neither
exists (`issues/001` says "not shipped"; `ReviewClient` has no consent checkbox).

- No-refund consent: "I accept no refund if I cancel or no-show on an online-paid ticket" —
  shown + an explicit consent action at checkout (`app/booking/review/**`). Block initiate
  until consented.
- PII-storage consent (guest PII retention notice, [S04]) captured at the same step.
- Persist consent records (who/what/when/version) — a `ConsentRecord` model or columns on the
  booking; immutable/audit-friendly (SYS13).
- Copy in Vietnamese to match the rest of the customer UI.

## Acceptance criteria

- [ ] No-refund consent shown + required at checkout; initiate blocked until consented.
- [ ] PII-storage consent captured at the same step.
- [ ] Consent persisted (who/what/when/version), queryable for compliance.
- [ ] Consent text versioned; VN copy.
- [ ] Test: initiate without consent → rejected; with consent → proceeds.

## Blocked by

- Blocked by `issues/042-add-booking-buyer-email.md`

## User stories addressed

- [S03] I accept no refund (shown + consented at checkout); [SYS13] consent capture.
