---
depends-on: [071-qr-signed-token]
type: FEATURE
wave: 4
spec: [S07, SYS08]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S07] / [SYS08]

## What to build

Operator **boarding scan + single-use check-in + mark no-show**. Today none exist: no
operator QR-verify endpoint, no `checkedInAt`, no-show enum value is read-only.

- Operator scan endpoint: verify the ticket token (issue 071) → confirm real + paid
  (amount/txn), return the manifest row. Tenant/operator-scoped + staff-trip-scoped.
- **Single-use check-in** via **atomic conditional update**:
  `UPDATE Booking SET checkedInAt = now() WHERE id = ? AND checkedInAt IS NULL` — rowcount 0
  = already checked in (handles two staff scanning at once, per [S07] / Mistake-Log race
  pattern). Add the `checkedInAt` column (migration).
- **Mark no-show**: an operator action that writes the `no_show` status (pairs `<verb>At`
  with status enum per Mistake-Log Issue 014 — add `noShowAt` if following that pattern).
- Manifest (issue exists) + Bookings view surface check-in state.

## Acceptance criteria

- [ ] `checkedInAt` column (migration); scan endpoint verifies real+paid before check-in.
- [ ] Concurrent double-scan → exactly one check-in succeeds (rowcount-0 on the second),
      integration test.
- [ ] Mark-no-show writes the `no_show` status (+ paired timestamp).
- [ ] Scan/check-in tenant + staff-trip scoped (no cross-operator leak).
- [ ] Manifest/Bookings show check-in/no-show state.

## Blocked by

- Blocked by `issues/071-qr-signed-token.md`

## User stories addressed

- [S07] scan QR at boarding → verify real+paid; single-use checked-in state; mark no-show.
