---
depends-on: [014-operator-booking-queue-manifest, 017-operator-staff-mgmt]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Operator-staff scoped client: a staff user logs in and only sees the trip they are assigned to (`OperatorUser.assignedTripId`). Reuses the queue / manifest / call-outcome / depart-complete endpoints from S14 but filtered through a staff-scope guard middleware. No admin actions (fleet / route / staff mgmt / reports).

- Auth middleware extension: if `role = staff`, server-side scope guard rewrites every `/api/op/*` query to constrain by `tripId = req.user.assignedTripId`. Cross-trip access returns 404 (not 403, to avoid leaking the existence of other trips).
- `/op/staff/dashboard` — single-trip view: queue for assigned trip, manifest tab, depart / complete actions.
- Endpoints reused (no new ones):
  - `GET /api/op/bookings?tripId=<assigned>` — auto-scoped.
  - `POST /api/op/bookings/:id/call-outcome` — allowed only when booking's `tripId` matches scope.
  - `POST /api/op/bookings/:id/picked-up` — same guard.
  - `POST /api/op/bookings/:id/cash-collected` — same guard.
  - `GET /api/op/manifest/:tripId` — guard rejects mismatched `tripId`.
  - `POST /api/op/trips/:id/depart` and `/complete` — guard rejects mismatched `tripId`.
- Staff with no `assignedTripId` sees an empty-state page directing them to ask their admin for a service assignment.
- UI hides admin nav entries (`Fleet`, `Routes`, `Trips`, `Reports`, `Staff`) entirely for `role = staff`.

## Acceptance criteria

- [ ] Staff calling `GET /api/op/bookings` without filters only receives bookings for their assigned trip.
- [ ] Staff calling any endpoint with a `tripId` ≠ their assigned trip receives 404.
- [ ] Staff `call-outcome`, `picked-up`, `cash-collected` work on assigned-trip bookings and are rejected on others.
- [ ] Staff can mark their assigned trip departed and completed; both actions trigger the same downstream effects (sales-close, T+3 payout job).
- [ ] Staff with `assignedTripId = null` sees the empty-state page and no admin nav.
- [ ] Re-assignment (S17) immediately switches the staff scope on next request — no stale session needed.

## Blocked by

- Blocked by `issues/014-operator-booking-queue-manifest.md`
- Blocked by `issues/017-operator-staff-mgmt.md`

## User stories addressed

- User story 62
- User story 63
- User story 64
- User story 65
