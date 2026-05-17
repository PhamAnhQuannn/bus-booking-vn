---
depends-on: [014-operator-booking-queue-manifest]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Operator creates a walk-in or phone-in booking directly without going through the customer hold + payment flow. Bookings are flagged as manual on the manifest.

- `POST /api/op/trips/:id/manual-booking` body `{ buyerName, buyerPhone, ticketCount, paymentMethod: 'paid' | 'cash' }`.
  - `'paid'` → status `paid_operator_notified` immediately (operator confirms they've already collected payment off-platform).
  - `'cash'` → status `pending_cash_payment` until staff marks it `cash-collected` at boarding (already wired in S14).
- Skips hold creation; decrements `availableSeats` atomically through the same predicate as `POST /api/holds`.
- Customer SMS confirmation dispatched via NotificationModule.
- Booking `isManual = true`; manifest UI flags as "manual booking".

## Acceptance criteria

- [ ] Manual booking is rejected if `ticketCount > availableSeats`.
- [ ] Manual-paid booking immediately appears on the manifest with `paid_operator_notified` status.
- [ ] Manual-cash booking appears with `pending_cash_payment` and is reconciled by the cash-collected action.
- [ ] Customer SMS confirmation is sent to the buyer phone.
- [ ] Manifest visibly distinguishes manual bookings from online bookings.

## Blocked by

- Blocked by `issues/014-operator-booking-queue-manifest.md`

## User stories addressed

- User story 48
