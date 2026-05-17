---
depends-on: [003-cash-booking-confirmation]
type: HITL
---

## Parent PRD

`issues/prd.md`

## What to build

MoMo payment-gateway adapter end-to-end: customer picks MoMo at checkout, is redirected to the MoMo sandbox, completes payment, and lands on the confirmation page with the booking transitioned to `paid_operator_notified`.

- Implement `PaymentGateway` interface in `PaymentModule` (defines `init(booking)` and `verifyWebhook(payload, signature)` per PRD § Implementation Decisions → PaymentModule).
- `MomoAdapter` implementing the interface against MoMo Vietnam ATM/Wallet sandbox; HMAC signature verify against vendor sample payloads.
- `POST /api/bookings/initiate` accepts `paymentMethod: 'momo'` and returns `{ redirectUrl }`.
- `POST /api/payments/webhook/momo` receiver: verifies signature, idempotently transitions Booking, emits customer + operator SMS via `NotificationModule`.
- `/booking/result?status=success|failed|cancelled` page reusing the confirmation UI on success; retry CTA on failure if hold is still active.
- Guest auto-attach: on `paid_operator_notified` transition, if `buyerPhone` matches an existing `Customer.phone`, set `booking.customerId`.

## Acceptance criteria

- [ ] Customer can complete a booking via MoMo sandbox end-to-end and reach the confirmation page.
- [ ] `MomoAdapter.verifyWebhook` rejects tampered signatures (unit test with vendor sample + flipped byte).
- [ ] Webhook handler is idempotent — replaying the same webhook does not double-transition or double-send SMS.
- [ ] Failed/cancelled gateway return lands on retry UI when hold still active; otherwise prompts re-search.
- [ ] Guest auto-attach sets `booking.customerId` when buyer phone matches an existing customer.
- [ ] Integration test uses a recorded vendor-sample webhook payload to drive the success transition.

## HITL requirements

MoMo merchant credentials (partnerCode, accessKey, secretKey) for the sandbox environment must be provisioned and stored in env vars before this slice can be fully tested. PRD § Further Notes flags PSP onboarding lead time as a schedule risk.

## Blocked by

- Blocked by `issues/003-cash-booking-confirmation.md`

## User stories addressed

- User story 9 (MoMo path)
- User story 10 (MoMo path)
- User story 13 (MoMo path)
