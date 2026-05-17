---
depends-on: [013-operator-trips]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Operator-facing booking queue and day-of operations manifest. Covers new-booking SMS + badge, sorted/filtered queue list, booking detail view, call-outcome recording (with pickup-point selection), manifest view, mark picked up, mark cash-on-pickup collected at boarding, mark trip departed / completed, and the upcoming-departures list.

- `GET /api/op/bookings?bus&serviceDate&route&contactStatus` — paid bookings queue sorted by departure.
- `GET /api/op/bookings/:id` — full detail.
- `POST /api/op/bookings/:id/call-outcome` body `{ outcome: 'reached'|'no-answer'|'callback', pickupPointId? , pickupNote? }`. Use pickup point dropdown when the route has configured pickup points; free-text note when it does not.
- `POST /api/op/bookings/:id/escalation` body `{ note }`. Flags booking in list view.
- `POST /api/op/bookings/:id/picked-up` — toggle boarding state.
- `POST /api/op/bookings/:id/cash-collected` — for `pending_cash_payment` bookings; transitions to `paid_operator_notified` and includes amount in payout calc.
- `POST /api/op/trips/:id/depart` and `POST /api/op/trips/:id/complete`.
- `GET /api/op/trips/upcoming` — sorted by departure; filter by route.
- `GET /api/op/manifest/:tripId` — name, phone, ticket count, pickup point, contact status, payment status. **No seat-number column.** Manual refresh button + "Last updated" timestamp; manual bookings flagged; cash bookings flagged.
- In-app notification badge: paid-bookings since last viewed by this operator user.
- Operator SMS to notification phone on new paid booking (already emitted in S3/S4/S5/S6 — verified here end-to-end).
- `/op/dashboard` (queue + badge), `/op/manifest/:tripId`, `/op/upcoming`.

## Acceptance criteria

- [ ] Paying a booking (any gateway or cash-collected) increments the operator notification badge and dispatches the operator SMS.
- [ ] Booking queue filters by bus / date / route / contact status work in combination.
- [ ] Call-outcome saves and reflects on manifest pickup column immediately.
- [ ] Cash-collected action transitions booking to `paid_operator_notified` and the payout calc in S16 picks it up.
- [ ] Mark depart blocks further bookings on that trip; mark complete triggers the T+3 payout job (S19).
- [ ] Manifest has no seat-number column.
- [ ] Last-updated timestamp updates on manual refresh.

## Blocked by

- Blocked by `issues/013-operator-trips.md`

## User stories addressed

- User story 44
- User story 45
- User story 46
- User story 47
- User story 49
- User story 50
- User story 51
- User story 52
- User story 53
- User story 54
- User story 55
