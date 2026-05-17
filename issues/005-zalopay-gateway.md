---
depends-on: [003-cash-booking-confirmation]
type: HITL
---

## Parent PRD

`issues/prd.md`

## What to build

ZaloPay payment-gateway adapter, parallel to the MoMo slice. Reuses the `PaymentGateway` interface, `BookingModule` transitions, and `/booking/result` UI defined in earlier slices.

- `ZaloPayAdapter` implementing `init` + `verifyWebhook` against ZaloPay Vietnam sandbox.
- `POST /api/bookings/initiate` accepts `paymentMethod: 'zalopay'`.
- `POST /api/payments/webhook/zalopay` receiver: signature verify, idempotent transition, NotificationModule dispatch.

## Acceptance criteria

- [ ] Customer can complete a booking via ZaloPay sandbox end-to-end.
- [ ] `ZaloPayAdapter.verifyWebhook` rejects tampered signatures (unit test with vendor sample).
- [ ] Webhook handler is idempotent.
- [ ] Failed/cancelled gateway return matches the MoMo retry behavior.
- [ ] Guest auto-attach behavior identical to MoMo path.

## HITL requirements

ZaloPay merchant credentials (appId, key1, key2) for the sandbox environment must be provisioned before this slice can be fully tested.

## Blocked by

- Blocked by `issues/003-cash-booking-confirmation.md`

## User stories addressed

- User story 9 (ZaloPay path)
- User story 10 (ZaloPay path)
- User story 13 (ZaloPay path)
