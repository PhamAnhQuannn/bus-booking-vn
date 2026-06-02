---
depends-on: [039-delete-cash-creation-paths-phase-a, 040-delete-paired-return-block-seats, 087-split-paid-operator-notified]
type: CHORE
wave: 7
spec: [S03, S07, S06, S15-1]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S03] / [S07] / [S06] (S15 item 1, Phase B)

## What to build

**Phase B migration** — drop the dead cash/phone-workflow enums + columns now that the
creation paths are gone (Phase A, issues 039/040). Committed migrations are never edited; this
is a forward migration, run **after a live-row check**.

- **Pre-check**: query for live rows using the doomed values (`pending_cash_payment` bookings,
  any `ContactStatus`/`pickedUpAt`/`escalationNote`/`escalatedAt` data, `blockedSeats > 0`,
  `PaymentMethod = 'cash'`). If any exist, decide on data disposition (anonymize/close/migrate)
  BEFORE dropping — document the finding.
- Drop: `PaymentMethod = 'cash'`, `BookingStatus = 'pending_cash_payment'`, `ContactStatus`
  enum, `Booking.pickedUpAt` / `escalationNote` / `escalatedAt`, `Trip.blockedSeats`.
- Remove all remaining read-side branches referencing the dropped values (grep clean across
  `app/**`, `lib/**`, `e2e/**`).
- Schema.prisma + SQL agree (Mistake-Log Issue 007).

## Acceptance criteria

- [ ] Live-row pre-check run + documented; no orphaned data left depending on dropped values.
- [ ] Enums/columns dropped via a forward migration (schema.prisma + SQL agree).
- [ ] No source reference to any dropped value remains (grep clean).
- [ ] Build + typecheck + full test suite green.

## Blocked by

- Blocked by `issues/039-delete-cash-creation-paths-phase-a.md`,
  `issues/040-delete-paired-return-block-seats.md`,
  `issues/087-split-paid-operator-notified.md`

## User stories addressed

- [S03]/[S07]/[S06] complete the cash/extras removal (Phase B enum/column drops).
