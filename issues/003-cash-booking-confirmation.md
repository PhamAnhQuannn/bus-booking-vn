---
depends-on: [002-hold-buyer-info-countdown]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

First end-to-end booking path that produces a confirmed booking record without a payment gateway: cash-on-pickup. Establishes the booking state machine, the NotificationModule with the eSMS stub adapter, and the confirmation page that subsequent gateway slices will reuse.

- Prisma `Booking`, `NotificationLog` models per PRD § Schema.
- `BookingModule` with status state machine (`awaiting_payment → paid_operator_notified | payment_failed_expired | pending_cash_payment`, plus cancellation/completion transitions wired up later).
- `POST /api/bookings/initiate` accepting `{ holdId, paymentMethod: 'cash' }` → creates Booking with status `pending_cash_payment`, converts the hold, returns `{ bookingId, status }`.
- `NotificationModule` with `eSMSAdapter` interface + console-log stub for dev/test. Typed templates `bookingPendingCash` (to customer) and `operatorNewBooking` (to operator notification phone).
- `/booking/confirmation/:id` page — no auth; bookingId UUID is the access key. Shows booking ref, route, ticket count, buyer info, operator contact phone, SMS confirmation status label. Bookings in `pending_cash_payment` show "Pay the operator on boarding" instructional copy.
- Booking ref format `BB-YYYY-XXXX` (base36) with insert-time collision check per PRD § Further Notes.
- Guest auto-attach hook stubbed (no-op for cash; wired up in S9 when bookings history exists).

## Acceptance criteria

- [ ] Completing a hold + initiating with `paymentMethod: 'cash'` lands on `/booking/confirmation/:id` with a real booking ref.
- [ ] Booking transitions: `awaiting_payment → pending_cash_payment` on cash init.
- [ ] NotificationLog records two entries per successful cash booking (customer + operator) with `status='sent'` when using the stub.
- [ ] eSMS stub adapter writes payloads to logs for dev; production adapter path is in place but not exercised in this slice.
- [ ] Confirmation page renders without authentication via the UUID id.
- [ ] Booking ref uniqueness validated under retry/collision (test forces a collision and asserts retry).
- [ ] Integration test: hold → cash init → confirmation page renders correct fields → NotificationLog has expected templates.

## Blocked by

- Blocked by `issues/002-hold-buyer-info-countdown.md`

## User stories addressed

- User story 9 (cash path)
- User story 11
- User story 12
- User story 14
- User story 66
- User story 69
