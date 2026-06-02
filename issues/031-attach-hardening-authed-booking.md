---
depends-on: [009-customer-bookings-history-pdf]
type: FIX
---

## Parent PRD

`issues/prd.md`

## What to build

Close the phone-spoof in guest→customer booking attachment (the accept-for-MVP risk
documented in `issues/009-customer-bookings-history-pdf.md` and in
`lib/booking/attachGuestBookingByPhone.ts`). Previously a booking attached to ANY
existing customer whose `Customer.phone` equalled the raw, user-typed `buyerPhone`.
An attacker typing a victim's phone at checkout would attach their booking to the
victim once that victim registered.

Make ownership the only way a booking attaches, with **zero** added checkout friction:

- Add `getCustomerOptional(req)` to `lib/auth/requireCustomerAuth.ts` — a non-throwing
  optional-auth read returning `customerId | null` from the `Authorization: Bearer`
  header.
- `POST /api/bookings/initiate` reads it and threads `customerId` through
  `initiateCashBooking` / `initiateOnlineBooking` into `createCashBookingFromHold` /
  `createOnlineBookingFromHold`, which now write `Booking.customerId` in the INSERT.
  A signed-in booking is **owned at creation** — the session is the proof.
- `app/booking/review/ReviewClient.tsx` forwards the in-memory access token as a
  Bearer header on the initiate call when present.
- **Remove** the spoofable `attachGuestBookingByPhone` call from every payment
  transition: `lib/payment/processWebhook.ts`, `lib/booking/recordCashCollected.ts`,
  `lib/booking/createManualBooking.ts`.
- Keep the OTP-proven register backfill (`backfillGuestBookingsForCustomer`, called
  from `lib/auth/authService.ts`) — the registrant verified the phone via OTP.
- No schema migration: `Booking.customerId` already exists (nullable FK,
  `onDelete: SetNull`, `@@index([customerId])`).

**Supersedes** the final AC of issue 009 ("a guest booking with phone matching an
existing customer attaches at payment-success time without UI prompt") — that
auto-attach is the spoof and is intentionally removed.

## Acceptance criteria

- [ ] A signed-in customer's booking has `Booking.customerId` set at creation, with no
      phone-match step (verified for both cash and online paths).
- [ ] A guest booking whose `buyerPhone` matches an already-registered customer does
      **not** auto-attach at payment-success / cash-collection / manual-paid.
- [ ] `getCustomerOptional` returns the customerId for a valid Bearer token and `null`
      for absent / malformed / tampered / operator-scoped tokens (never throws).
- [ ] Register-time backfill still links a registrant's own prior guest bookings.
- [ ] Spoof regression test: guest booking with a registered victim's phone, run the
      paid transition → `booking.customerId IS NULL`.
- [ ] `attachGuestBookingByPhone` is no longer imported by any payment-transition
      module; its doc comment records the resolution.

## Blocked by

- Blocked by `issues/009-customer-bookings-history-pdf.md`

## User stories addressed

- Hardens the guest→customer identity link against phone spoofing.
