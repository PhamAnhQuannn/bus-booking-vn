---
depends-on: [003-cash-booking-confirmation]
type: HITL
---

## Parent PRD

`issues/prd.md`

## What to build

Card (Visa/Master) payment via a Vietnamese PSP (Onepay or NgânLượng — final pick at PSP-onboarding time). Reuses the same `PaymentGateway` interface and BookingModule transitions.

- `CardAdapter` implementing `init` + `verifyWebhook` against the selected PSP's sandbox.
- `POST /api/bookings/initiate` accepts `paymentMethod: 'card'`.
- `POST /api/payments/webhook/card` receiver.
- 3-D Secure redirect chain handled inside the PSP-hosted flow (we never see the card pan).

## Acceptance criteria

- [ ] Customer can complete a card booking via the PSP sandbox end-to-end (3DS flow included).
- [ ] `CardAdapter.verifyWebhook` rejects tampered signatures.
- [ ] Webhook handler is idempotent.
- [ ] PCI-DSS scope is limited to redirect-only — no card data ever touches our servers.

## HITL requirements

- PSP merchant onboarding — flagged as the single biggest schedule risk in PRD § Further Notes. Lead time can be 6–12 weeks.
- Final PSP pick is a HITL architectural decision once onboarding feasibility is known.
- Credentials provisioned + production callback URLs registered before launch.

## Blocked by

- Blocked by `issues/003-cash-booking-confirmation.md`

## User stories addressed

- User story 9 (Card path)
- User story 10 (Card path)
- User story 13 (Card path)
