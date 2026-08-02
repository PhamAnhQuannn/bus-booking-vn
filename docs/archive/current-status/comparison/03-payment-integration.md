# Payment Integration — Spec vs Reality

Per-adapter comparison across DS-003, DS-005, DS-007, DS-008, DS-009, DS-013, FI-008, HD-006.

> **Phase 1 note (GL-006):** Only SePay/VietQR + cash needed. MoMo, VNPay, ZaloPay, Card adapters are Phase 2+. Refund/chargeback flows deferred — manual bank transfer refund for Phase 1 low volume.

---

## Adapter Status Matrix

| Adapter | Spec | Webhook Route | Service Code | Stub | Real | Launch Phase |
|---|---|---|---|---|---|---|
| Adapter | Spec | Webhook Route | Service Code | Stub | Real | Launch Phase | GL-006 Phase 1? |
|---|---|---|---|---|---|---|---|
| MoMo IPN | FI-008 | `/api/payments/momo/webhook` | `lib/payment/momoGateway.ts` | Yes | No | Phase 2+ | DEFERRED |
| VNPay IPN | FI-008 | `/api/payments/vnpay/webhook` + `/vnpay/return` | `lib/payment/vnpayGateway.ts` | Yes | No | Phase 2+ | DEFERRED |
| SePay/VietQR | DS-013 | `/api/payments/bank_transfer/webhook` | None | No | No | Phase 1 | **CRITICAL** |
| ZaloPay | DS-008 | `/api/payments/zalopay/webhook` | None | No | No | Phase 3 | DEFERRED |
| Card | FI-008 | `/api/payments/card/webhook` | `lib/payment/cardGateway.ts` | Yes | No | Phase 2+ | DEFERRED |

**Overall:** 3 of 5 adapters have stub implementations. 0 of 5 have real (production) implementations. SePay and ZaloPay have zero code. **Phase 1 only needs SePay.**

---

## 1. MoMo Adapter

**Spec says (FI-008, DS-005):**
- HMAC SHA-256 webhook verification using `WEBHOOK_HMAC_MOMO`
- `FAILURE_RESULT_CODES` pinned to AC exact set: `{1001, 1002, 1003, 1004, 1005, 4100}` (Mistake Log Issue 004)
- IPN webhook processes payment state transition
- Feature gate: `PAYMENTS_STUB` env var

**Reality:**
- `lib/payment/momoGateway.ts` exists with stub implementation
- `app/api/payments/momo/webhook/route.ts` exists
- HMAC verification implemented
- `FAILURE_RESULT_CODES` set corrected per Mistake Log Issue 004
- Real MoMo API calls gated behind `PAYMENTS_STUB=false`
- Real MoMo credentials not provisioned

**Status:** STUB COMPLETE. Real mode requires `PAYMENTS_STUB=false` + `MOMO_PARTNER_CODE` + `MOMO_ACCESS_KEY` + `MOMO_SECRET_KEY`.

---

## 2. VNPay Adapter

**Spec says (FI-008, DS-005):**
- HMAC SHA-512 webhook verification using `WEBHOOK_HMAC_VNPAY`
- IPN webhook + return URL handling
- `tmnCode` (merchant code) from platform account

**Reality:**
- `lib/payment/vnpayGateway.ts` exists with stub implementation
- `app/api/payments/vnpay/webhook/route.ts` + `vnpay/return/route.ts` exist
- HMAC verification implemented
- Real VNPay API calls gated behind `PAYMENTS_STUB=false`
- Real VNPay credentials not provisioned

**Status:** STUB COMPLETE. Same pattern as MoMo.

---

## 3. SePay / VietQR Bank Transfer — NOT IMPLEMENTED

**Spec says (DS-013, FI-008, HD-006):**

Webhook defense stack (4 layers):
1. Bearer token verification (constant-time comparison), invalid/missing → 401
2. Idempotency via `PaymentEvent @@unique([adapter, providerTxnId])`
3. Amount guard (underpay rejection, overpay logging, oversold refund)
4. Oversold race guard (`SELECT FOR UPDATE` on Trip, recount paid seats)

BookingRef extraction:
- Regex: `/BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}/i` (case-insensitive, handles banking app uppercasing)
- Unmatched transfers → admin reconciliation (not error to SePay)

VietQR configuration:
- `VIETQR_ACCOUNT_NUMBER` (Agribank) + `VIETQR_BANK_BIN` (`970405`)
- QR code via `img.vietqr.io` (server-side memo pre-fill, I7 invariant: no client-originated price)
- BookingRef 18 chars fits Agribank 25-char memo limit

Processing sequence:
- Bearer verify → bookingRef extract → booking lookup → PaymentEvent INSERT → status transition → FunnelEvent → post-commit `after()`
- Booking: `awaiting_payment -> paid`
- Ledger: `booking_credit` + `platform_fee`
- Notifications: `customerBookingPaid` + `operatorNewBooking`

**Reality:**
- No `lib/payment/sepay.ts` or `lib/payment/vietqr.ts` exists
- No webhook route handler exists
- No VietQR display page exists
- No SePay vendor account setup
- `paymentReconSweeper` cron not built (backup for unmatched transfers)
- Memo mismatch reconciliation dashboard not built

**Gap:** ENTIRE payment flow missing. DS-013 is fully designed but zero code exists.

**Resolution:** This is a Phase 1 launch requirement. Must implement before go-live. Requires:
1. SePay account + Agribank setup (business prerequisite)
2. Implement `lib/payment/sepay.ts` per DS-013
3. Implement webhook route with 4-layer defense stack
4. Build VietQR display page
5. Build admin reconciliation for unmatched transfers

---

## 4. ZaloPay Adapter — STUB ONLY

**Spec says (DS-008):**
- `PaymentAdapter` enum extended with `'zalopay'`
- HMAC SHA-256 verification with `key2`
- Sandbox vs production endpoint separation
- Feature gate `ZALOPAY_ENABLED`
- `FAILURE_RESULT_CODES` set must come from AC verbatim (per Mistake Log Issue 004 rule)
- Environment variables: `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2`, `ZALOPAY_ENDPOINT`

**Reality:**
- `zalopay` value exists in `PaymentAdapter` enum
- Webhook route placeholder may exist
- No real adapter code (`lib/payment/zalopayGateway.ts` has stub at most)
- No `FAILURE_RESULT_CODES` set defined
- No `ZALOPAY_ENABLED` feature flag in code

**Status:** Phase 3 (Month 3-6 post-launch). Not a launch blocker. Design complete, implementation deferred.

---

## 5. Card Gateway — STUB ONLY

**Spec says (FI-008):**
- Generic card payment adapter for domestic ATM/debit cards
- Webhook handler at `/api/payments/card/webhook`

**Reality:**
- `lib/payment/cardGateway.ts` exists with stub implementation
- `app/api/payments/card/webhook/route.ts` exists
- No real gateway integration (would typically go through VNPay or separate PSP)

**Status:** Phase 2 feature. Stub in place.

---

## 6. Refund Flow — SKELETON ONLY

**Spec says (DS-007):**

5 API endpoints:
| Endpoint | Purpose |
|---|---|
| `POST /api/bookings/{id}/cancel` | Customer self-cancel + refund trigger T1 |
| `GET /api/customers/me/refunds` | Customer refund list (paginated) |
| `GET /api/admin/refunds` | Admin refund list with filters |
| `POST /api/admin/refunds/{id}/retry` | Admin retry failed refund |
| `POST /api/admin/refunds/{id}/complete` | Admin manual completion (bank transfer) |

4 refund triggers:
- T1: Customer self-cancellation
- T2: Operator cancels trip → automatic refund for all paid bookings
- T3: Oversold race (paid seats > capacity after concurrent webhooks)
- T4: Overpayment (bank transfer amount > booking price)

**Reality:**
- `Refund` model exists in Prisma schema
- `RefundStatus` enum exists (requested, processing, completed, failed, permanently_failed)
- `RefundReason` enum exists
- None of the 5 API endpoints exist
- PSP refund dispatch throws `PspRefundNotImplementedError`
- T2 (operator cancel) triggers `cancelTrip` which references refund but cannot execute
- T3/T4 triggers are enqueued via post-commit `after()` but handler is stub

**Gap:** Data model ready. Service + routes absent.

**Resolution:** For Phase 1 (bank transfer only), no programmatic PSP refund API exists — admin initiates manual bank transfer. Implement at minimum: customer cancel endpoint + admin manual completion endpoint.

---

## 7. Chargeback & Dispute Flow — SCHEMA MISSING

**Spec says (DS-010):**
- Chargeback tracking on PayoutAccount
- `disputeStatus`, `chargebackAmount` columns
- `chargeback` and `payout_reversal` ledger entry types
- Holdback reserve for card/MoMo phases

**Reality:**
- DS-010 design spec exists
- No `disputeStatus` or `chargebackAmount` on any model
- No `chargeback` or `payout_reversal` in `LedgerEntryType` enum
- No dispute tracking flow in admin console

**Gap:** Phase 1 (bank transfer only) has no PSP chargeback risk (push-only payments). But card/MoMo phases WILL need this.

**Resolution:** Defer to Phase 2 (card gateway launch). Document deferral explicitly.

---

## 8. Payment Stub Gate — ENV Configuration

**Spec says (FI-008, SI-006):**
- `PAYMENTS_STUB=true` in development → all payment webhooks return success without network I/O
- `PAYMENTS_STUB=false` in production → real PSP API calls
- Zod boot validation should reject `PAYMENTS_STUB=false` without corresponding PSP credentials

**Reality:**
- `PAYMENTS_STUB` env var exists and gates MoMo/VNPay adapters
- `app/dev/stub-pay` provides local dev payment gateway UI
- Boot validation for stub→real transition: partially implemented (not all credential combinations validated)

**Status:** Working for dev. Production transition requires credential provisioning + boot validation completion.
