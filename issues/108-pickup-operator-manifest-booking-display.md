---
depends-on: [issue-104, issue-107]
labels: [pickup-areas, operator, manifest]
---

## Parent PRD

`issues/prd-pickup-areas.md`

## What to build

Operator visibility of the traveler's pickup choice — **read-only** (no post-payment editing).

- Booking detail (`app/op/(console)/bookings/[id]/**`) and trip manifest (`lib/booking/getManifest.ts` + manifest UI) show each passenger's `pickupAreaLabel` + `pickupDetail` (or "Tại bến xe" when `pickupKind='station'`).
- Confirm the legacy post-payment pickup **assign/edit** mutation + its endpoint are gone (removal began in 104); booking detail surfaces pickup as plain text, no edit control.
- Manifest rows organized so pickup location is visible per passenger.

See PRD §"Operator surfaces" + grilled decision #4.

## Acceptance criteria

- [ ] Booking detail shows pickup area + detail (or station label), read-only — no edit/assign control.
- [ ] Manifest shows pickup area + detail per passenger row.
- [ ] No API path exists to mutate a booking's pickup after creation.
- [ ] `pnpm tsc --noEmit` + `pnpm test` green; `/smoke-test` operator golden paths pass (no 500s).

## Blocked by

- Blocked by `issues/104-pickup-schema-migration-pickuppoint-removal.md` (Booking pickup fields + display-chain repoint).
- Blocked by `issues/107-pickup-traveler-booking-flow.md` (bookings must carry traveler-set pickup data to display).

## User stories addressed

- User story 8
- User story 9
