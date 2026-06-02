---
depends-on: []
type: CHORE
wave: 0.5
spec: [S06, S15-6]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S06] (S15 ratified item 6)

## What to build

Delete **paired-return** and **block-seats** — neither has a spec story; block-seats
contradicts the count-based model. Remove routes + libs now; the `Trip.blockedSeats`
column DROP is Phase B (Wave 7).

- Delete `app/api/op/trips/[id]/paired-return/**` + `lib/trips/pairedReturn.ts` (+ its
  `TripErrorCode` variants like `bus_overlap_with_outbound` if unused elsewhere — check
  reassign still uses `busHasOverlappingTrip`, not the paired-return path).
- Delete `app/api/op/trips/[id]/block-seats/**` + `lib/trips/blockSeats.ts`.
- Remove any read-side use of `Trip.blockedSeats` (search availability must compute
  `capacity − held − booked` WITHOUT a blocked term, OR keep treating absent as 0 until
  the column drops in Wave 7). Confirm `lib/db/searchTrips.ts` / `holdRepo.ts` no longer
  depend on `blockedSeats`.
- Delete associated unit/int/e2e specs; grep `pairedReturn`, `paired-return`, `blockSeats`,
  `block-seats`, `blockedSeats` across `app/**`, `lib/**`, `e2e/**`.

Leave `Trip.blockedSeats` column in schema (Phase B drop, Wave 7).

## Acceptance criteria

- [ ] `paired-return` + `block-seats` routes and libs deleted; no import references remain.
- [ ] Availability math no longer reads `blockedSeats` (or safely treats it as 0 pending
      column drop).
- [ ] `bus_overlap_with_outbound` / paired-return error codes removed if orphaned.
- [ ] Build + typecheck + tests green; related specs removed.
- [ ] `Trip.blockedSeats` column still present (Wave 7 drops it).

## Blocked by

- none

## User stories addressed

- [S06] count-based model; no manual seat-blocking, no auto reverse-route trip creation.
