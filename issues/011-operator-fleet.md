---
depends-on: [010-operator-auth-force-pwd-change]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Operator fleet management: add, edit, deactivate buses; schedule maintenance windows.

- Prisma `Bus`, `BusMaintenance` models per PRD § Schema.
- `GET/POST/PATCH /api/op/buses`, `POST /api/op/buses/:id/deactivate`, `POST /api/op/buses/:id/maintenance` (range), `DELETE /api/op/buses/:id/maintenance/:mid`.
- Validation: `busType ∈ { coach, sleeper, limousine }`, `capacity > 0`, license plate unique per operator.
- Capacity edit guard: reject if reduces below `max(activeHolds + paidBookings)` on any future trip using this bus.
- Maintenance edit flags affected future trips so admin can manually reassign in S13.
- Deactivated bus hidden from future trip-creation dropdown but does not break existing scheduled trips.
- `/op/buses` list + create/edit dialog; maintenance scheduler subview.

## Acceptance criteria

- [ ] Adding a bus with duplicate license plate within the same operator returns a validation error.
- [ ] Capacity reduction is rejected when an existing future trip on this bus has more paid bookings than the new capacity.
- [ ] Scheduling maintenance during a date with existing trips on this bus surfaces a flagged list ("X trips conflict with this maintenance window").
- [ ] Deactivating a bus removes it from the new-trip dropdown without affecting existing scheduled trips.
- [ ] Operator can only view/edit their own operator's buses.

## Blocked by

- Blocked by `issues/010-operator-auth-force-pwd-change.md`

## User stories addressed

- User story 30
- User story 31
- User story 32
- User story 33
