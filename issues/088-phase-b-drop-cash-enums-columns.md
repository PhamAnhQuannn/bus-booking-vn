---
depends-on: [039-delete-cash-creation-paths-phase-a, 040-delete-paired-return-block-seats, 087-split-paid-operator-notified]
type: CHORE
wave: 7
spec: [S03, S07, S06, S15-1]
---

> ✅ **DONE 2026-06-03 (cash-only descope).** Dropped the cash rail residue:
> `PaymentMethod='cash'`, `BookingStatus='pending_cash_payment'`, `Booking.cashCollectedAt`,
> the derived `cashFlag` UI/DTO, cash display labels, and every dead `pending_cash_payment`
> "paid-status" filter member (~40 files). Migration `20260603040000_drop_cash_residue`
> (recreate-enum dance). `tsc` clean, lint clean, 1408 unit tests green. Migration apply +
> integration/e2e pending DB availability.
>
> ⚠️ **DESCOPED — NOT done (the rest of this issue's original scope):** `ContactStatus`,
> `Booking.pickedUpAt`/`escalationNote`/`escalatedAt`, and `Trip.blockedSeats` were **kept**.
> They are NOT cash — research found them load-bearing for LIVE features:
> `blockedSeats` is still written by trip-create and read by the bus-reassign capacity guard
> (`lib/trips/reassignBus.ts`); the contact/escalation fields power the live op booking-queue
> (Issue 014). File separate follow-up issues to retire those features before dropping them.

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
