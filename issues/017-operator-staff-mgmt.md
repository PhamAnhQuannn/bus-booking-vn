---
depends-on: [010-operator-auth-force-pwd-change]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Operator-admin creates, edits, disables, and assigns operator staff members. Staff users are scoped via the same `OperatorUser` table with `role = staff` and a single `assignedTripId` (V1 constraint).

- `POST /api/op/staff` body `{ name, phone }` → creates `OperatorUser` row with role `staff`, `requiresPasswordChange = true`, generates a temporary password and SMS-sends it via NotificationModule (`staffTempPassword` template).
- `PATCH /api/op/staff/:id` — edit name; cannot change role in V1.
- `POST /api/op/staff/:id/disable` — `disabledAt = now()`. Active sessions/refresh tokens revoked.
- `POST /api/op/staff/:id/assign-service` body `{ tripId }` — replaces existing assignment (single staff per service in V1).
- `/op/staff` list + dialog; per-trip assign control inside `/op/trips/:id`.

## Acceptance criteria

- [ ] Creating a staff member dispatches an SMS with the temporary password to their phone (visible in NotificationLog when using the stub).
- [ ] Staff first-login is forced through the password-change flow from S10.
- [ ] Disabled staff cannot log in; existing refresh tokens are invalidated immediately.
- [ ] Assigning the same staff to a different trip replaces the previous assignment.
- [ ] Admin cannot manage staff outside their own operator.

## Blocked by

- Blocked by `issues/010-operator-auth-force-pwd-change.md`

## User stories addressed

- User story 59
- User story 60
- User story 61
