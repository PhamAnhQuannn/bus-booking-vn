---
depends-on: [045-operator-approval-state-machine]
type: FEATURE
wave: 1
spec: [S05, S14, SYS04, SYS12]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S14] / [S05] / [SYS04]

## What to build

The **approval gate, defense-in-depth**: only `APPROVED` operators' trips appear in search
AND approval is re-checked at booking-initiate. Today neither path filters operator status
(`searchTrips.ts:72-90`, `initiateBooking` / `app/api/bookings/initiate/route.ts:36-137`).

- Search query (`lib/db/searchTrips.ts` + `app/api/trips/search/route.ts`): exclude trips
  whose operator `status != APPROVED` (and not SUSPENDED) — in the `where`, not in-memory.
  Also exclude `disabledAt`-equivalent.
- Trip detail (`app/trips/[id]`) + getTripDetails: same exclusion (don't leak a non-approved
  operator's trip via direct link).
- Booking-initiate re-check: before creating a hold→booking, re-verify the trip's operator
  is APPROVED; reject with a clean error if not (defense-in-depth — covers the race where an
  operator is suspended after search).
- Use the per-state capability helper from issue 045 (single source of truth, no duplicated
  status literals).

## Acceptance criteria

- [ ] Search results exclude non-APPROVED / suspended operators' trips (where-clause).
- [ ] Direct trip-detail link for a non-approved operator's trip is not bookable.
- [ ] Booking-initiate rejects a trip whose operator is not APPROVED at initiate time.
- [ ] Integration test: operator flips PENDING→APPROVED→SUSPENDED, search + initiate honor
      each state.
- [ ] No status literal duplicated — gate reads the capability helper.

## Blocked by

- Blocked by `issues/045-operator-approval-state-machine.md`

## User stories addressed

- [S14] approval gate enforced in search AND re-checked at booking-initiate (defense in
  depth).
