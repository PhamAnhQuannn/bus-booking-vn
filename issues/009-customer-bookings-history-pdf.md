---
depends-on: [003-cash-booking-confirmation, 007-customer-otp-auth]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Authenticated customers can view bookings history, see full detail per booking, and download a PDF ticket. Guest auto-attach completes the loop so historical guest bookings appear in history when the phone matches an existing customer.

- `GET /api/bookings?tab=upcoming|past` (auth required) — returns customer's bookings with status badges per PRD AC for story 15.
- `GET /api/bookings/:id` — owner or matching-id-only access.
- `GET /api/bookings/:id/ticket` — PDF stream via `@react-pdf/renderer` showing booking ref, passenger name, ticket count, operator phone, total. **No seat numbers.**
- `/account/bookings` page with Upcoming / Past tabs and status badges; `/account/bookings/:id` detail page; download-PDF button.
- Wire the guest auto-attach hook (stubbed in S3) into the actual `paid_operator_notified` transition: match `buyerPhone` to `Customer.phone`, set `booking.customerId`.

## Acceptance criteria

- [ ] Logged-in customer with prior bookings sees them under Upcoming / Past sorted appropriately.
- [ ] Status badge text matches PRD's full enum for story 15.
- [ ] Detail page shows route, departure, ticket count, buyer info, total, status, operator contact phone.
- [ ] PDF ticket renders correctly, opens in browser, downloads with filename including booking ref. **No seat numbers in the PDF.**
- [ ] A guest booking made before the customer registers, then the customer registers with the same phone → that booking is visible in history after login.
- [ ] A guest booking with phone matching an existing customer attaches at payment-success time without UI prompt.

## Blocked by

- Blocked by `issues/003-cash-booking-confirmation.md`
- Blocked by `issues/007-customer-otp-auth.md`

## User stories addressed

- User story 15
- User story 16
- User story 17
- User story 18
