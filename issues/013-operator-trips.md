---
depends-on: [011-operator-fleet, 012-operator-routes-pickup-points]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Operator trip lifecycle: create, edit, sales toggle, block capacity (integer), reassign bus, cancel (atomic with SMS to all affected customers), recurring trip templates, and paired return-trip creation.

- Prisma `Trip` model per PRD § Schema with `availableSeats = bus.capacity − blockedSeats − activeHolds − paidBookings` enforced as a derived getter and as the inequality predicate in the atomic hold UPDATE (S2).
- Prisma `RecurringTripTemplate` model. Generator job produces independent Trip rows.
- Endpoints under `/api/op/trips/*`:
  - `GET/POST/PATCH /api/op/trips`
  - `POST /api/op/trips/:id/sales-toggle` (sales auto-close at departure handled in cron S19)
  - `POST /api/op/trips/:id/block-seats` body `{ blockedSeats }`
  - `POST /api/op/trips/:id/reassign-bus` body `{ busId }` — blocked when `activeHolds + paidBookings > newBus.capacity`
  - `POST /api/op/trips/:id/cancel` body `{ reason }` — atomic transaction: trip → cancelled, bookings → trip_cancelled, holds → cancelled_trip, emits per-customer SMS via NotificationModule (story 68)
  - `POST /api/op/trips/from-template` for recurring template instantiation
  - `POST /api/op/trips/:id/paired-return` — pre-fills swapped origin/destination + same bus/price; operator enters return departure time
- New-trip create validates bus is not deactivated and not in a maintenance window covering departure.
- `/op/trips` list + create/edit dialog; per-trip detail page with the actions above.

## Acceptance criteria

- [ ] Creating a trip with a maintenance-covered bus is rejected.
- [ ] Block-seats rejects values that exceed current `availableSeats`.
- [ ] Reassigning a bus is blocked when the new bus capacity is too small for current holds+bookings.
- [ ] Cancelling a trip atomically updates trip, bookings, and holds, and emits one SMS per affected booking (assert via NotificationLog).
- [ ] Recurring template generates the expected set of independent Trip rows; editing one does not affect siblings.
- [ ] Paired-return action pre-fills swap + bus + price; operator sets return departure and saves a new independent Trip.
- [ ] Closing sales removes the trip from customer search results; existing bookings remain valid.

## Blocked by

- Blocked by `issues/011-operator-fleet.md`
- Blocked by `issues/012-operator-routes-pickup-points.md`

## User stories addressed

- User story 37
- User story 38
- User story 39
- User story 40
- User story 41
- User story 42
- User story 43
- User story 68
