---
depends-on: []
type: FIX
wave: 0
spec: [S06, S15-6]
---

> 🔎 **Reality-check 2026-06-01: CONFIRMED REAL (small, P2).** `app/api/op/trips/[id]/route.ts:60-66`
> applies `price` unconditionally; only guard is `status==='cancelled'` (line 58). No paid-seat
> check. Add a "any paid booking on this trip?" guard before applying a price change → 422.
> NOTE: this file also writes `blockedSeats` (line 65) which Wave 0.5 issue 040 deletes — coordinate.

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S06] (S15#6 ratified)

## What to build

Enforce **price lock after first paid seat**. `app/api/op/trips/[id]/route.ts:60-66` +
`lib/validation/trip.ts:28-40` apply `price` PATCH unconditionally; the only guard is
`status !== 'cancelled'`. A paid trip's price can be silently mutated.

Spec [S06] / S15#6 default: once **any seat is paid**, `price` + `departureAt` are LOCKED;
a material change ⇒ cancel + rebook. Non-material edits (pickup notes) stay allowed.
(`departureAt` is not in the PATCH schema today, so only `price` needs the guard now —
but assert both for future-proofing.)

- In the trip PATCH path, before applying a `price` change, check whether the trip has
  **any paid booking** (paid + active-held? — paid is the lock trigger per spec). If yes,
  reject the price change with a validation error (HTTP 422, consistent with [S06]/I11
  validation-failure convention).
- Do the read+guard inside the existing transaction / with a consistent read so it can't
  race a concurrent sell (FOR UPDATE on trip row if a write follows).
- Allow non-material edits (notes/pickup) regardless.

## Acceptance criteria

- [ ] PATCH `price` on a trip with ≥1 paid booking → 422 `price_locked_after_sale`; price
      unchanged.
- [ ] PATCH `price` on a trip with zero paid bookings → succeeds.
- [ ] Non-material field edit (e.g. pickup note) succeeds even with paid bookings.
- [ ] Unit test covers locked + unlocked + non-material paths.
- [ ] `departureAt` lock asserted (or documented as not-editable via current schema).

## Blocked by

- none

## User stories addressed

- [S06] As operator, price + departureAt LOCKED once any seat paid (material change ⇒
  cancel+rebook).
