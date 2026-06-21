# FI-008: Payment Integration (Tich hop thanh toan)

> **Status:** DOCUMENTED
> **Last Updated:** 2026-06-20
> **Related:** ADR-005, ADR-006, ADR-009, ADR-019, DS-001, DS-005, DS-007, DS-013, FD-015

## Overview

FI-008 covers the inbound payment pipeline: receiving PSP webhooks (MoMo, VNPay, bank transfer via SePay), verifying them, transitioning bookings from `awaiting_payment` to `paid`, writing double-entry ledger rows, and enqueueing notifications and e-invoices. The current implementation uses a central collection model (single platform merchant account), with split-settlement (marketplace model) documented as the target architecture in DS-009 but not yet implemented.

## Scope & Boundaries

### In Scope

- PSP webhook receipt and verification (MoMo IPN, VNPay IPN + return URL, SePay bank transfer webhook)
- HMAC signature verification and idempotency via `PaymentEvent @@unique([adapter, providerTxnId])`
- Amount guard (currency + underpay/overpay logic)
- Booking state transition `awaiting_payment -> paid | payment_failed_expired`
- Oversold race detection (Layer 2 capacity guard via `SELECT FOR UPDATE` on Trip)
- Double-entry ledger writes: `booking_credit` + `platform_fee`
- EInvoice row creation (status='pending') on paid transition
- NotificationLog enqueue: `customerBookingPaid` + `operatorNewBooking`
- PSP adapter anti-corruption layer (normalization to canonical status)
- Payment method selection UI, VietQR QR display page, MoMo/VNPay redirect flows
- Refund triggers T3 (oversold) and T4 (overpay) -- post-commit via `after()`
- Split-settlement migration path (documented in DS-009, not yet implemented)

### Out of Scope

- Payout settlement/disbursement -> [FI-010](../FI-010-payout-system/README.md)
- Customer-initiated refund / trip-cancel refund -> [FI-009](../FI-009-operator-console/README.md) / DS-007
- Tax withholding -> [FI-010](../FI-010-payout-system/README.md) / DS-011
- E-invoice MISA submission -> [FI-015](../FI-015-e-invoice/README.md) / DS-014
- Operator KYB / onboarding -> [FI-002](../FI-002-operator-onboarding/README.md)

### Bounded Context(s)

**Payment Context** -- PaymentEvent, Refund, webhook pipeline. Gateway-agnostic payment processing via `PaymentGateway` interface with per-PSP adapters (MoMo, VNPay, stub).

**Finance/Ledger Context** -- LedgerEntry, FeeConfig. Double-entry accounting with append-only immutability.

**Booking Context** -- Booking state transitions triggered by payment webhooks. Hold consumption on successful payment.

**Notification Context** -- NotificationLog enqueue for booking confirmation and operator notification.

**E-Invoice Context** -- EInvoice row creation at paid transition (status='pending').

## Key Entities

### PaymentEvent

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| PaymentEvent | id (UUID PK, `gen_random_uuid()`), bookingId (UUID FK->Booking), adapter (String: `'momo' \| 'vnpay' \| 'bank_transfer' \| 'zalopay' \| 'stub'`), providerTxnId (String), currency (String default `'VND'`), rawBody (Text), receivedAt (DateTime default `now()`) | `@@unique([adapter, providerTxnId])` -- idempotency guard: P2002 violation -> 200 no-op | T3 Financial retention: 5+ years per Accounting Law. `@db.Uuid` on id |

### LedgerEntry

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| LedgerEntry | id (CUID PK), operatorId (String FK->Operator), bookingId (UUID? FK->Booking onDelete:Restrict), payoutId (String? -- no FK, decoupled), type (LedgerEntryType enum), amount (BigInt, signed VND), currency (String default `'VND'`), sourceEventId (String), createdAt (DateTime default `now()`) | `@@unique([sourceEventId])` -- idempotency key. PostgreSQL `BEFORE UPDATE/DELETE` trigger `ledger_entry_immutable` | Append-only. sourceEventId formats: `booking:<bookingId>` (booking_credit), `fee:<bookingId>` (platform_fee), `refund_out:<key>` (refund) |

**LedgerEntryType enum:** `booking_credit`, `platform_fee`, `refund_debit`, `refund_out`, `payout_debit`, `payout_reversal`, `chargeback`, `adjustment`, `tax_withheld`

### FeeConfig

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| FeeConfig | id (CUID PK), operatorId (String? FK->Operator onDelete:Restrict), ratePpm (Int), effectiveFrom (DateTime), effectiveTo (DateTime?), createdBy (String?), createdAt (DateTime default `now()`) | NULL operatorId = global default; non-null = per-operator override | ratePpm=60000 = 6% default. Floor: 50000 ppm (5%). Ceiling: `MAX_FEE_OVERRIDE_PPM=200000` (20%). Effective-dated: never edit in place |

### Booking (Payment-relevant columns)

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| Booking | id (UUID PK), bookingRef (String @unique, `BB-YYYY-[0-9a-z]{4}-[0-9a-z]{4}`), totalVnd (Int), paymentMethod (PaymentMethod enum), status (BookingStatus default `awaiting_payment`), refundedAt (DateTime?), einvoiceRef (String?), einvoiceIssuedAt (DateTime?), discountVnd (Int default 0) | CHECK enforces einvoiceRef/einvoiceIssuedAt both-or-neither | totalVnd = Trip.price x ticketCount (I7 -- never client-supplied). PaymentMethod: `momo \| vnpay \| bank_transfer \| cash \| zalopay \| card` |

### Refund

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| Refund | id (CUID PK), bookingId (UUID FK->Booking onDelete:Restrict), amount (Int VND), reason (RefundReason enum), status (RefundStatus default `requested`), pspRefundRef (String?), requestedBy (String), requestedAt (DateTime default `now()`), completedAt (DateTime?), failureReason (String?), retryCount (Int default 0), nextRetryAt (DateTime?), createdAt (DateTime default `now()`) | `@@unique([idempotencyKey])`. `@@index([status, lastAttemptAt])` for cron pickup | RefundReason: `oversold \| trip_cancelled \| customer_request \| payment_error \| customer_cancel \| trip_cancel \| overpay \| admin_manual`. RefundStatus: `requested \| processing \| completed \| failed` |

## API Endpoints

### Webhook Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| POST | `/api/payments/momo/webhook` | HMAC SHA-256 (body-signed) | MoMo IPN callback -- payment result | 200 (all cases except HMAC fail), 400 (invalid HMAC) |
| POST | `/api/payments/vnpay/webhook` | HMAC SHA-512 (body-signed) | VNPay IPN callback -- authoritative confirmation | 200, 400 |
| GET | `/api/payments/vnpay/return` | HMAC SHA-512 (query params) | VNPay return URL -- browser redirect after payment (dual confirmation, idempotent) | 200, 400 |
| POST | `/api/payments/bank_transfer/webhook` | Bearer token (`SEPAY_API_KEY`) | SePay webhook -- bank transfer confirmation (5-30s) | 200, 401 |

**HTTP contract (S1-frozen):** Always 200 to PSP except 400 for invalid HMAC. Non-200 causes PSP retry storms. Returning 200 for: duplicate (P2002), amount mismatch, booking not found, pending/unknown status.

### Customer-Facing Payment Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| POST | `/api/bookings/initiate` | Customer JWT or guest | Creates booking from hold, calls PSP gateway, returns `payUrl` + `confirmationToken` | 200, 400, 422 |
| GET | `/api/bookings/status?token=<confirmationToken>` | None (token-based) | Polled by bank transfer page to detect paid status | 200 |

### Refund Endpoints (DS-007)

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| POST | `/api/bookings/{id}/cancel` | Customer JWT | Customer self-cancel + refund (CPL 2023 Art. 29 3-day window) | 200 (incl. already cancelled), 404, 422 |
| GET | `/api/customers/me/refunds` | Customer JWT | List customer's refunds (paginated) | 200 |
| GET | `/api/admin/refunds` | Admin JWT | Admin refund list with filters | 200 |
| POST | `/api/admin/refunds/{id}/retry` | Admin JWT | Admin retry of failed refund | 200, 422 |
| POST | `/api/admin/refunds/{id}/complete` | Admin JWT | Admin manual complete (bank transfer) | 200, 422 |

## State Machine

### Booking Status (state-machines.md S2)

**States:** `awaiting_payment` | `paid` | `completed` | `cancelled` | `trip_cancelled` | `no_show` | `payment_failed_expired` | `refunded`

**Terminal states:** `completed`, `cancelled`, `trip_cancelled`, `no_show`, `payment_failed_expired`, `refunded`

**LEGAL_BOOKING_TRANSITIONS** (single source of truth: `lib/booking/transitions.ts`):

| From | To | Trigger | Guard |
|------|----|---------|-------|
| `awaiting_payment` | `paid` | PSP webhook confirms success | `amount >= booking.totalVnd`, `currency = 'VND'`. `legalPredecessors('paid')` in WHERE clause prevents replays regressing advanced rows |
| `awaiting_payment` | `payment_failed_expired` | PSP failure webhook or hold-expiry sweeper | Guarded by `legalPredecessors` |
| `paid` | `completed` | Operator check-in (`lib/booking/checkIn.ts`) | Sets `checkedInAt` |
| `paid` | `trip_cancelled` | `cancelTrip` cascade | Bulk UPDATE. Post-commit `refundOut` |
| `paid` | `no_show` | Operator marks no-show | Sets `noShowAt` |
| `paid` | `refunded` | Oversold-race detection inside `applyPaidStatusTransition` | Same transaction as paid transition. When `paid_count > capacity` after marking paid |

### Webhook-Triggered Booking Transitions (DS-005 S6.1)

| Webhook Status | Booking Transition | Guard | Side Effects |
|----------------|-------------------|-------|-------------|
| `paid` | `awaiting_payment -> paid` | `amount >= totalVnd`, `currency = 'VND'`, legal predecessor check | Hold -> `consumed`; 2 LedgerEntry rows; 2 NotificationLog rows; EInvoice row |
| `paid` (oversold) | `awaiting_payment -> paid -> refunded` (same tx) | `SELECT FOR UPDATE` on Trip; `paid_count > capacity` | Post-commit `refundOut` keyed `oversold_race:<bookingId>` |
| `failed` | `awaiting_payment -> payment_failed_expired` | Legal predecessor check | None (terminal) |
| `pending` / `unknown` | No transition | -- | PaymentEvent INSERT only |

### EInvoice Status (state-machines.md S7)

| From | To | Trigger |
|------|-----|---------|
| *(creation)* | `pending` | Booking reaches `paid` |
| `pending` | `issued` | Submitted to MISA meInvoice; sets `invoiceNumber`, `issuedAt` |
| `issued` | `sent` | Delivery confirmed |
| `pending` | `failed` | Submission failure |
| `issued` | `failed` | Delivery failure |
| `issued` / `sent` | `cancelled` | Voided -- new EInvoice row created for correction |

## Business Rules & Invariants

1. **I7 -- No Client-Originated Price** -- `totalVnd = Trip.price x ticketCount` computed server-side at booking creation. Customer-facing endpoints (`/api/holds/**`, `/api/bookings/**`, `/api/payments/**`) never accept price in request body. Enforcement: `lib/booking/initiateOnlineBooking.ts`; amount guard in webhook.

2. **I1 -- Concurrency Control (SELECT FOR UPDATE)** -- Every read-then-write on shared state runs inside `$transaction` (callback form) with `SELECT ... FOR UPDATE` on the gating row. All booking/payout/ledger service functions.

3. **Ledger Immutability** -- No UPDATE or DELETE on LedgerEntry permitted. Append-only. Enforcement: PostgreSQL `BEFORE UPDATE/DELETE` trigger `ledger_entry_immutable`.

4. **Idempotency (PaymentEvent)** -- `@@unique([adapter, providerTxnId])` -- P2002 -> 200 no-op. Enforcement: `lib/payment/processWebhook.ts`.

5. **Idempotency (LedgerEntry)** -- `sourceEventId` unique constraint prevents double-crediting from webhook replays. All `appendBookingPaidLedger` calls.

6. **Amount Guard** -- `amount >= booking.totalVnd` AND `currency = 'VND'`. Underpay: no transition. Overpay: mark paid + post-commit overpay refund-out. Enforcement: DS-005 S4.3.

7. **Oversold Race (L2)** -- After marking booking `paid`, `SELECT FOR UPDATE` on Trip, recount paid seats; if `paid > capacity` -> `refunded` + post-commit `refundOut` keyed `oversold_race:<bookingId>`. Enforcement: `lib/payment/applyPaidTransition.ts`.

8. **HMAC Verification** -- MoMo: HMAC SHA-256. VNPay: HMAC SHA-512. Invalid HMAC -> HTTP 400 (only non-200 response to PSP). Per-PSP adapter, pre-transaction.

9. **BigInt Math** -- All VND x fractional rate computations in BigInt domain. `ratePpm` encoding (60000 = 6%). ES2017: `BigInt(n)` constructor only, no `1n` suffix. Enforcement: `lib/ledger/feeConfig.ts`, `lib/ledger/calcPayout.ts`.

10. **W2 -- Always 200 to PSP** -- Always HTTP 200 except 400 for invalid HMAC (S1-frozen contract). Enforcement: DS-005 S11.

11. **W5 -- Failure Result Codes Pinned** -- `FAILURE_RESULT_CODES` pinned to AC verbatim: `{1001, 1002, 1003, 1004, 1005, 4100}`. Never augmented from vendor docs. Enforcement: MoMo adapter.

12. **PSP_WINDOW_MINUTES** -- 20 minutes (MoMo 15-min retry + 5-min buffer). `awaiting_payment` bookings within this window still occupy capacity. Enforcement: `lib/core/db/holdRepo.ts`.

13. **HOLD_TTL_MINUTES** -- 10 minutes. Hold must be consumed before expiry.

14. **W12 -- Booking Not Found -> 200** -- No enumeration leak on webhook routes. Enforcement: webhook handlers.

15. **I9 -- No Raw Phone in NotificationLog Payload** -- `NotificationLog.recipient` is the sole PII column. `payload` JSON must NOT contain phone. Enforcement: all NotificationLog INSERTs.

16. **CSRF Exemption** -- Webhook routes authenticated via HMAC are exempt from CSRF double-submit check. Exemption is exact-path-match `Set`, not prefix. Enforcement: `proxy.ts` Edge middleware.

## Frontend Surfaces

| Page | Path | Key Components | Notes |
|------|------|----------------|-------|
| Booking Review | `/booking/review` | Trip summary, passenger info, price breakdown, payment method selection, consent checkboxes, CTA button | Requires `bb_hold` cookie. Data loaded via `getHoldDetails()` in-process (no self-fetch per Mistake Log Issue 003) |
| Payment Method Selection | (component on `/booking/review`) | Radio group: Bank transfer ("Chuyen khoan", Phase 1), Cash ("Thanh toan khi len xe", Phase 1), MoMo ("Vi MoMo", Phase 2), VNPay ("VNPay (The/QR/Vi)", Phase 2) | Default: bank transfer |
| MoMo Flow | Redirect to MoMo app | `POST /api/bookings/initiate` -> MoMo redirect URL -> MoMo app deep-link -> `/booking/result/[confirmationToken]` | |
| VNPay Flow | Redirect to VNPay portal | `POST /api/bookings/initiate` -> VNPay portal redirect -> dual confirmation (return URL + IPN) -> `/booking/result/[confirmationToken]` | |
| Bank Transfer QR | `/booking/bank-transfer?bookingRef=...&amount=...` | VietQR QR code (`img.vietqr.io`), bank details with copy buttons, hold timer, polling every 5s for `status='paid'`, auto-redirect on paid | |
| Cash Confirmation | `/booking/confirmation/[confirmationToken]` | Direct confirmation (no PSP interaction). "Cho ngoi da duoc dat. Vui long thanh toan khi len xe." | |
| Price Transparency | (section on review page) | `{qty} x {unit_price}`, bold total, "Da bao gom VAT", "Khong phat sinh phi them" | Server-derived. I7 compliance |
| E-Wallet Cap Warning | (inline on payment method card) | Warning for >= VND 10M (biometric trigger) or general monthly cap | |
| Consent Checkboxes | (on review page) | `no_refund` + `pii_storage`. Both required before CTA enabled. Pre-ticked prohibited (PDPL 2025) | |
| Hold Timer | (sticky top bar) | Countdown; HoldExpiryModal (non-dismissible) on expiry | |
| Payment Failure Recovery | (error screen) | PSP redirect fail, declined, hold expiry, network error, 60s timeout scenarios with retry/switch options | |

**CTA variants by payment method:**
- MoMo / VNPay: "Xac nhan dat ve va thanh toan"
- Bank transfer: "Xac nhan dat ve va chuyen khoan"
- Cash: "Dat cho -- thanh toan khi len xe"

## Regulatory Requirements

| Law/Decree | Requirement | Impact |
|------------|-------------|--------|
| Decree 52/2024/ND-CP Art. 3(17) | IPS license NOT required if platform does not perform "thu ho/chi ho" (collect and remit). Target: PSP split-settlement so platform never holds customer funds | NOT_IMPLEMENTED -- current central collection model = highest regulatory risk |
| Circular 41/2025/TT-NHNN | E-wallet single transaction >= VND 10M triggers biometric auth. Monthly cap VND 100M | Warning UI in spec; enforcement is PSP-side |
| Consumer Protection Law 2023 (19/2023/QH15) Art. 29 | 3-business-day cancellation right for remote contracts. Automated refund-to-original-payment within 24-48h | Specified in DS-007; implementation TBD |
| Art. 6 Decree 10/2020, CPL 2023, Pricing Law 2023 | Total price displayed before payment commitment. No hidden fees. VAT-inclusive. Prices in VND only | Implemented in FD-015 |
| E-Transactions Law 2023 | Consumer must review and confirm before completing transaction. Review page IS the confirmation step | Implemented in FD-015 |
| Decree 53/2022 + Law 116/2025 (eff. 1 Jul 2026) | Webhook-processed data stored in Vietnam-hosted PostgreSQL. Cross-border log processing requires CDTIA filing with A05 within 60 days | CDTIA not filed |
| PDPL 2025 | Breach notification: 72h to A05; 24h for cybersecurity attacks; + individual notification for financial data | Procedures not documented |
| Internal security (ADR-008) | Sandbox sentinel detection: reject `VNPAY_TMN_CODE === 'VNPAYTEST'` or `MOMO_PARTNER_CODE === 'MOMOBKUN20180529'` in production. `VNPAY_HASH_SECRET` >= 32 chars enforced via Zod `superRefine` at boot | Implemented |

## Testing Strategy

### Unit Tests

- Fee calculation (BigInt): edge cases where Number and BigInt results diverge
- bookingRef generation: format `BB-YYYY-[0-9a-z]{4}-[0-9a-z]{4}` with `BOOKING_REF_REGEX`
- HMAC verification logic per PSP adapter
- Canonical status normalization from raw provider result codes
- `LEGAL_BOOKING_TRANSITIONS` map: valid and invalid transitions

### Integration Tests

- `PaymentEvent @@unique([adapter, providerTxnId])` dedup: insert same event twice, assert second is 200 no-op
- `LedgerEntry.sourceEventId` unique constraint (idempotency)
- `$transaction` callback form with `SELECT FOR UPDATE` on Trip in oversold check
- `BEFORE UPDATE/DELETE` trigger on LedgerEntry (attempt update -> error)
- Amount guard branching: underpay (no transition), overpay (paid + refund-out)
- Three-layer capacity guard Layer 2: assert `status = 'refunded'` when `paid_count > capacity`
- Conditional INSERT for booking creation
- Concurrent-write integration test in same commit as any lock code

### E2E Tests

- Happy paths: MoMo payment -> confirmation; VNPay return URL -> confirmation; bank transfer QR -> SePay webhook -> redirect
- CSRF header threading via `primeCsrf()` from `e2e/helpers/csrf.ts` (webhook routes exempt; `/api/bookings/initiate` requires it)
- URL-drive form-incidental flows (not synthetic keystrokes on third-party inputs per Mistake Log Issue 002)
- Sandbox-gated PSP specs marked `// @sandbox-only`, excluded from CI
- Hex string validity in crypto mocks: 64-char hex strings for SHA-256 comparisons

## Cross-References

- **Architecture Decisions:** [ADR-005](../../architecture-decisions/ADR-005-payment-architecture/README.md), [ADR-006](../../architecture-decisions/ADR-006-pricing-currency/README.md), [ADR-009](../../architecture-decisions/ADR-009-capacity-guard/README.md), [ADR-012](../../architecture-decisions/ADR-012-background-jobs/README.md), [ADR-019](../../architecture-decisions/ADR-019-state-machines/README.md)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md), [DS-005](../../design-specifications/DS-005-webhook-design/README.md), [DS-007](../../design-specifications/DS-007-refund-flow/README.md), [DS-009](../../design-specifications/DS-009-split-settlement/README.md), [DS-013](../../design-specifications/DS-013-vietqr-reconciliation/README.md)
- **Frontend Design:** [FD-015](../../frontend-design/FD-015-payment-checkout/README.md)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md), [state-machines.md](../../business/domain-model/state-machines.md), [invariants-catalog.md](../../business/domain-model/invariants-catalog.md), [event-flows.md](../../business/domain-model/event-flows.md), [ubiquitous-language.md](../../business/domain-model/ubiquitous-language.md)
- **Regulatory:** [payment.md](../../business/regulatory/payment.md), [psp-contract-terms.md](../../business/regulatory/psp-contract-terms.md), [data-privacy.md](../../business/regulatory/data-privacy.md)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md)

## Known Gaps & Open Questions

- **CRITICAL -- Central collection model (NOT split-settlement)** -- Current implementation constitutes "thu ho/chi ho"; requires IPS license under Decree 52/2024. Rated CRITICAL/CERTAIN in risk-matrix. Legal opinion required before go-live (ADR-005 D1 IMPLEMENTATION STATUS: NOT_IMPLEMENTED).
- **CRITICAL -- SePay account + Agribank bank connection not set up** -- No bank transfer webhook without SePay. Must complete before go-live.
- **HIGH -- Chargeback workflow absent** -- No `paid -> chargeback` state, no reserve, no admin queue, no ledger entry type, T+1 exposure vs 45-90 day window. Design chargeback workflow OR implement holdback reserve before go-live.
- **HIGH -- Transport e-invoice fields missing** -- Decree 70/2025: vehicle plate number + route required on ticket invoice. Must add to EInvoice before go-live.
- **HIGH -- Tax withholding NOT_IMPLEMENTED** -- E-Commerce Law 2025 eff. 1 Jul 2026. Schema ready; `calcWithholding()` not implemented. Must implement before July 2026.
- **HIGH -- CDTIA not filed** -- Overseas log processing (Vercel Singapore) constitutes cross-border PII transfer. Penalty: 5% revenue. File with A05 before go-live.
- **HIGH -- Bank transfer: no programmatic refund** -- Manual bank transfer required for all bank_transfer refunds. Document manual process; admin reconciliation UI needed.
- **MEDIUM -- Sentry/BetterStack not deployed** -- No unhandled exception capture, no external uptime monitoring. Deploy before go-live.
- **MEDIUM -- Webhook volume anomaly alerting not built** -- Payment anomaly <=5 min detection target unmet. Build before go-live.
- **MEDIUM -- Payout Int column overflow** -- `Payout.grossVnd/feeVnd/netVnd/taxVat/taxPit/taxTotal` are `Int` (32-bit, max ~2.1B VND). Large aggregate payouts could overflow. Monitor; migrate to BigInt at scale.
- **LOW -- `paymentReconSweeper` cron not built** -- SePay webhook is primary; cron is optional backup for orphaned transfers. Post-launch.
- **LOW -- IP allowlist for PSP webhooks** -- HMAC is primary auth; IP is defense-in-depth. Post-launch hardening.
- **LOW -- ZNS primary channel not integrated** -- SMS fallback functional. Post-launch.
