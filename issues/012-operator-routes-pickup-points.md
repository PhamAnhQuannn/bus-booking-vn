---
depends-on: [010-operator-auth-force-pwd-change]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Operator route management plus per-route pickup points. Pickup points are used downstream in call-outcome capture and the manifest pickup column.

- Prisma `Route`, `PickupPoint` models per PRD § Schema.
- `GET/POST/PATCH /api/op/routes`, `POST /api/op/routes/:id/deactivate`, `GET/POST/PATCH/DELETE /api/op/routes/:id/pickup-points`.
- Validation: origin + destination required free text; durationMinutes integer > 0.
- Deactivated route hidden from new-trip-creation dropdown; existing trips unaffected.
- Pickup point fields: name, address, displayOrder (integer).
- `/op/routes` list + edit dialog; pickup-points subview with drag-to-reorder.

## Acceptance criteria

- [ ] Operator can create / edit / deactivate routes scoped to their own operator.
- [ ] Pickup points persist with display order and render in that order in downstream UIs.
- [ ] Deactivated route hidden from trip-creation dropdown but does not break existing trips.
- [ ] A route with no pickup points is still valid (downstream UIs fall back to free-text pickup note).

## Blocked by

- Blocked by `issues/010-operator-auth-force-pwd-change.md`

## User stories addressed

- User story 34
- User story 35
- User story 36
