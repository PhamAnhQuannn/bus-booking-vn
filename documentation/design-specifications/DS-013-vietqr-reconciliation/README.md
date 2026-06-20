# DS-013 -- VietQR Bank Transfer Design (SePay Webhook)

> **Updated 2026-06-20**: Rewritten from poll-based cron reconciliation to SePay webhook (push-based, near-instant confirmation). Previous version described a `paymentReconSweeper` cron as the primary confirmation path — that design is superseded. SePay webhook is now the primary path; cron-based reconciliation is demoted to optional backup for orphaned transfers.

## 1. Overview

This document defines the VietQR bank transfer payment architecture for the BusBooking platform. Customers scan a VietQR QR code, transfer money via their banking app to the platform's Agribank account, and **SePay** (sepay.vn) — a bank account monitoring service — sends a webhook to confirm the transfer in near-real-time (5-30 seconds).

Unlike the original DS-013 design (poll-based cron with 30-minute latency), the SePay webhook approach makes bank transfer confirmation **event-driven (push)**, identical in architecture to MoMo and VNPay. The bank transfer adapter implements the same `PaymentGateway` interface, reuses `processPaymentWebhook`, and writes the same `PaymentEvent` + `LedgerEntry` rows.

**Source ADRs.** ADR-005 (Payment Architecture), ADR-012 (Background Jobs). Business context from regulatory/payment.md, regulatory/psp-contract-terms.md, domain-model/event-flows.md, domain-model/state-machines.md, domain-model/invariants-catalog.md.

**Cross-references.** DS-001 for `PaymentEvent`, `Booking`, `LedgerEntry` entity schemas. DS-003 for route namespace table and middleware auth chain. DS-005 for PSP adapter layer, amount guard, and `applyPaidStatusTransition` pipeline.

---

## 2. How Bank Transfer Fits the Existing Payment Model

With SePay, bank transfer confirmation is push-based — same as MoMo/VNPay:

| PSP | Confirmation Model | Platform Action | Latency |
|-----|-------------------|-----------------|---------|
| MoMo | PSP sends IPN webhook with HMAC signature | Receive, verify HMAC, apply paid transition | Sub-second |
| VNPay | PSP sends IPN webhook with HMAC-SHA512 signature | Receive, verify HMAC, apply paid transition | Sub-second |
| **Bank transfer (SePay)** | SePay monitors Agribank account; sends webhook with bearer token auth on incoming transfer | Receive, verify bearer token, extract bookingRef from memo, apply paid transition | **5-30 seconds** |

**Key architectural consequence:** Bank transfer uses the same `PaymentGateway` adapter interface, the same `processPaymentWebhook` pipeline, and the same `PaymentEvent` idempotency model as MoMo/VNPay. No `ReconAttempt` model, no cron sweeper, no poll-based reconciliation needed for the primary path.

**Remaining risk:** If the customer pays but the memo is wrong, truncated, or missing, the SePay webhook still fires (money arrived) but the adapter cannot extract a bookingRef → the webhook returns 200 (event logged) but no booking transitions to `paid`. This edge case (~5% of transfers) requires admin manual reconciliation — same as the original design, but for a much smaller fraction of transactions.

---

## 3. Bank Transfer Payment Flow

### 3.1 End-to-End Sequence

```
Customer selects "Chuyển khoản" at checkout
  |
  v
POST /api/bookings/initiate { holdId, paymentMethod: 'bank_transfer', consents }
  → Creates Booking (status = 'awaiting_payment')
  → Adapter returns payUrl = /booking/bank-transfer?bookingRef=...&amount=...
  |
  v
Browser redirects to internal QR display page (/booking/bank-transfer)
  → Shows VietQR code with pre-filled: Agribank account, amount, bookingRef as memo
  → Shows bank details below QR (account number, holder name, amount, transfer content)
  → Client component polls GET /api/bookings/status every 5 seconds
  |
  v
Customer scans QR with banking app (any Vietnamese bank)
  → Amount and memo pre-filled from QR
  → Customer confirms transfer
  |
  v
Bank processes transfer (NAPAS 24/7 domestic = instant)
  → Money arrives in platform's Agribank account
  |
  v
SePay detects incoming transfer (5-30 seconds)
  → Sends POST /api/payments/bank_transfer/webhook
  → Authorization: Bearer <SEPAY_API_KEY>
  → Body: { id, gateway, transferAmount, content, referenceCode, ... }
  |
  v
Webhook route:
  1. Verify bearer token (401 if mismatch)
  2. processPaymentWebhook({ rawBody, gateway: bankTransferAdapter, adapter: 'bank_transfer' })
     → adapter.verifyWebhook(rawBody) extracts bookingRef from content field
     → INSERT PaymentEvent (idempotent via @@unique([adapter, providerTxnId]))
     → applyPaidStatusTransition (same pipeline as MoMo/VNPay)
     → Booking: awaiting_payment → paid
     → LedgerEntry: booking_credit + platform_fee
     → NotificationLog: customerBookingPaid + operatorNewBooking
  |
  v
Client polling detects status = 'paid' → auto-redirect to /booking/result/[token]
Customer receives SMS confirmation
```

### 3.2 QR Code Generation

QR image served by VietQR public API (free, no credentials, EMVCo standard):

```
https://img.vietqr.io/image/{BIN}-{ACCOUNT}-{TEMPLATE}.png?amount={amount}&addInfo={bookingRef}
```

| Field | Value | Source |
|-------|-------|--------|
| Bank BIN | `970405` (Agribank) | Environment config (`VIETQR_BANK_BIN`) |
| Account number | `3516205005863` | Environment config (`VIETQR_ACCOUNT_NUMBER`) |
| Account holder | Configurable | Environment config (`VIETQR_ACCOUNT_NAME`) |
| Amount | `booking.totalVnd` (exact VND integer) | Server-derived (I7 invariant) |
| Memo | `bookingRef` (e.g., `BB-2026-a1b2-c3d4`) | Generated at booking creation |
| Template | `compact2` | Environment config (`VIETQR_TEMPLATE`) |

Amount is server-derived from `Trip.price * Hold.ticketCount` at booking creation (Invariant I7: no client-originated price). The memo is the 18-character `bookingRef`.

**Source:** ADR-005 D7, ADR-006 D3, ADR-010 D6 (I7 invariant).

---

## 4. SePay Integration

### 4.1 What SePay Does

SePay (sepay.vn) is a Vietnamese bank account monitoring service. It connects to bank accounts (Agribank, Vietcombank, MBBank, Techcombank, BIDV, etc.) and sends HTTP webhooks when transactions occur. The platform uses SePay's incoming-transfer webhook as the payment confirmation signal.

### 4.2 SePay Webhook Payload

```json
{
  "id": 123456,
  "gateway": "Agribank",
  "transactionDate": "2026-06-20 14:30:00",
  "accountNumber": "3516205005863",
  "subAccount": null,
  "transferType": "in",
  "transferAmount": 250000,
  "accumulated": 5000000,
  "code": null,
  "content": "BB-2026-a1b2-c3d4",
  "referenceCode": "FT26171...",
  "description": "..."
}
```

### 4.3 Webhook Authentication

SePay uses **bearer token** authentication (not body-signed HMAC like MoMo/VNPay):

```
Authorization: Bearer <SEPAY_API_KEY>
```

The route handler verifies the bearer token BEFORE calling `processPaymentWebhook`. This differs from MoMo/VNPay where signature verification happens inside `verifyWebhook(rawBody)`. Rationale: the `PaymentGateway.verifyWebhook()` interface takes only `rawBody` (designed for body-signed HMAC); bearer token auth is a header concern, not a body concern. The VNPay webhook route already follows this pre-verify pattern.

### 4.4 Adapter Mapping

The bank transfer adapter's `verifyWebhook(rawBody)` maps SePay fields to `CanonicalPaymentEvent`:

| CanonicalPaymentEvent field | SePay source | Notes |
|----------------------------|-------------|-------|
| `orderRef` | Regex extraction from `content` | Case-insensitive match; lowercased |
| `providerTxnId` | `String(payload.id)` | SePay's transaction ID (dedup key) |
| `amount` | `payload.transferAmount` | VND integer |
| `currency` | `'VND'` | Hardcoded (domestic transfers only) |
| `status` | `'paid'` if `transferType === 'in'` && amount > 0; else `'unknown'` | |

### 4.5 SePay vs Alternatives

| Option | Description | Confirmation Latency | Cost |
|--------|-------------|---------------------|------|
| **SePay (chosen)** | Bank monitoring + webhook push | 5-30 seconds | ~100-500k VND/month |
| Casso | Similar service, HMAC webhook auth | 5-30 seconds | ~100-500k VND/month |
| Direct bank API polling | Per-bank API integration + cron sweeper | Up to 30 minutes | Free (API access) |
| Manual CSV upload | Admin uploads bank statement | Hours/days | Free |

**Decision:** SePay for primary confirmation. Simpler auth model (bearer token vs HMAC), good Agribank coverage, push-based webhook eliminates cron latency.

---

## 5. BookingRef Extraction from Transfer Memo

### 5.1 Regex Matching

The bookingRef regex is **non-anchored** and **case-insensitive** to handle banking apps that uppercase QR-prefilled memos:

```
Pattern: /BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}/i
```

The extracted ref is lowercased before DB lookup (bookingRef uses lowercase base36 per `lib/booking/bookingRef.ts`).

| Memo Content | Match Result | Handling |
|-------------|--------------|----------|
| `BB-2026-a1b2-c3d4` | Match | Exact bookingRef |
| `BB-2026-A1B2-C3D4` | Match (case-insensitive) | Lowercased to `bb-2026-a1b2-c3d4` |
| `thanh toan BB-2026-a1b2-c3d4 ve xe` | Match | Customer added text around ref |
| `BB2026a1b2c3d4` | No match | Customer removed dashes |
| `ve xe khach` | No match | Customer omitted bookingRef entirely |

Use `BOOKING_REF_REGEX` exported from `lib/booking/bookingRef.ts` in production code rather than re-typing the pattern (Mistake Log Issue 003).

**Source:** ADR-005 D7, Mistake Log Issue 003.

### 5.2 Amount Guard

Handled by the existing `processPaymentWebhook` pipeline (DS-005 SS4.3):

| Condition | Action |
|-----------|--------|
| `amount >= booking.totalVnd` | Proceed with paid transition |
| `amount > booking.totalVnd` | Mark paid + post-commit overpay refund-out (same as MoMo/VNPay) |
| `amount < booking.totalVnd` | Reject — booking stays `awaiting_payment` |

Unlike the original DS-013 (exact match only, all mismatches to admin), the SePay webhook reuses the same amount guard as MoMo/VNPay. Overpayments are auto-processed; underpayments are rejected.

### 5.3 No-Match Handling

When SePay sends a webhook but the adapter cannot extract a bookingRef from `content`:

1. `verifyWebhook()` returns `{ ok: false, reason: 'no_booking_ref_in_memo' }`
2. `processPaymentWebhook` logs the event but does NOT create a `PaymentEvent` (no booking to link)
3. The transfer is real (money arrived) but unlinked — requires admin manual reconciliation
4. Admin can search `awaiting_payment` bookings by amount + timestamp to find the match

---

## 6. Memo Truncation Risk

### 6.1 Vietnamese Bank Memo Field Limits

| Bank | Memo Field Limit | Risk Level |
|------|-----------------|------------|
| Vietcombank | 50 characters | Low |
| MBBank | 70 characters | Low |
| Techcombank | 140 characters | Low |
| VietinBank | 50 characters | Low |
| BIDV | 140 characters | Low |
| Agribank | 25 characters | Medium |
| Some smaller banks | 20-25 characters | High |

The `bookingRef` is 18 characters (`BB-2026-a1b2-c3d4`). Fits within even the most restrictive 25-character limit. If the customer adds text before the reference, the ref may be pushed past the truncation boundary.

### 6.2 Mitigation Strategies

| Strategy | Implementation | Effectiveness |
|----------|---------------|---------------|
| **QR code pre-fill** | Memo field pre-filled in QR code; banking apps auto-populate | High |
| **UI copy button** | One-tap copy of bookingRef on QR page | High |
| **Bookingref-only memo** | QR memo is `bookingRef` only (no prefix text) | High |
| **Case-insensitive regex** | Handles banking apps that uppercase the memo | High |
| **Non-anchored regex** | Extracts bookingRef from anywhere in memo | Medium |
| **Admin reconciliation** | Manual matching for unmatched transfers | Fallback |

### 6.3 Failure Scenarios

| Scenario | Frequency Estimate | Handling |
|----------|-------------------|----------|
| Customer uses QR pre-fill exactly | ~85% | Automated match via SePay webhook |
| Customer adds text around bookingRef | ~10% | Automated match (non-anchored regex) |
| Customer omits bookingRef entirely | ~3% | Unmatched; admin reconciliation by amount + timestamp |
| Customer types wrong bookingRef | ~1% | Unmatched or wrong-match; admin review |
| Memo truncated past bookingRef | ~1% | Unmatched; admin reconciliation |

---

## 7. Data Model

### 7.1 No New Models Required

The SePay webhook approach reuses existing models without additions:

| Model | Role in Bank Transfer | Same as MoMo/VNPay? |
|-------|----------------------|---------------------|
| `PaymentEvent` | Stores webhook event; `adapter='bank_transfer'`, `providerTxnId=String(sepayPayload.id)` | Yes |
| `Booking` | Status transition: `awaiting_payment → paid` | Yes |
| `LedgerEntry` | Double-entry: `booking_credit` + `platform_fee` | Yes |
| `NotificationLog` | SMS confirmation to customer + operator | Yes |

`PaymentEvent @@unique([adapter, providerTxnId])` provides idempotency — duplicate SePay webhooks produce a P2002 violation caught as a no-op (200 return).

### 7.2 ReconAttempt Model (Deferred)

The original DS-013 defined a `ReconAttempt` model for tracking poll-based reconciliation state. With SePay webhook as the primary path, `ReconAttempt` is **not needed at launch**. It may be introduced later if:

- A cron-based backup reconciliation sweeper is built (post-launch)
- Admin manual reconciliation UI needs to track unmatched transfers

---

## 8. Backup Reconciliation (Optional, Post-Launch)

### 8.1 paymentReconSweeper — Demoted to Backup

The `paymentReconSweeper` cron described in the original DS-013 is **no longer the primary confirmation path**. It is demoted to an optional backup for edge cases:

- SePay webhook delivery failure (SePay outage, network issue)
- SePay webhook processing failure (application error, DB unavailable)
- Orphaned transfers where SePay webhook was received but bookingRef extraction failed

**Status:** Not yet built. Not a go-live blocker. SePay webhook covers the primary path.

### 8.2 When to Build

Build the backup sweeper when:
- SePay webhook failure rate exceeds 1% over 7 days
- Admin manual reconciliation volume exceeds 5 transactions/day
- Regulatory audit requires proof of reconciliation completeness

---

## 9. QR Display Page

### 9.1 Page Structure

Route: `/booking/bank-transfer?bookingRef=...&amount=...&redirectUrl=...`

```
+----------------------------------------------------------+
|  [Hold Timer - sticky]       Thời gian giữ chỗ: 08:42   |
+----------------------------------------------------------+
|                                                          |
|  CHUYỂN KHOẢN NGÂN HÀNG                                  |
|                                                          |
|  +------------------------------------------------------+|
|  |  [VietQR Code Image]                                 ||
|  |  (pre-filled: account, amount, bookingRef)           ||
|  +------------------------------------------------------+|
|                                                          |
|  Ngân hàng: Agribank                                     |
|  Số tài khoản: 3516205005863        [Copy]               |
|  Chủ tài khoản: <from env>                               |
|  Số tiền: 250.000đ                  [Copy]               |
|  Nội dung CK: BB-2026-a1b2-c3d4    [Copy]               |
|                                                          |
|  Hướng dẫn:                                              |
|  1. Mở ứng dụng ngân hàng                                |
|  2. Quét mã QR hoặc nhập thông tin chuyển khoản          |
|  3. Kiểm tra số tiền và nội dung chuyển khoản            |
|  4. Xác nhận chuyển khoản                                |
|                                                          |
|  [Đang chờ thanh toán...]                                |
|                                                          |
+----------------------------------------------------------+
```

### 9.2 Client Component Behavior

- **Copy buttons**: clipboard copy for account number, amount, bookingRef
- **Polling**: `GET /api/bookings/status?token=<confirmationToken>` every 5 seconds
- **Auto-redirect**: when status = `'paid'` → redirect to `/booking/result/[token]`
- **Hold timer**: countdown from `expiresAt`; shows expiry message + `/search` link when 0
- **Fallback**: if QR image fails to load, show manual transfer details prominently

---

## 10. Security Considerations

### 10.1 SePay Webhook Authentication

| Control | Implementation |
|---------|---------------|
| Auth method | Bearer token (`Authorization: Bearer <SEPAY_API_KEY>`) |
| Credential storage | Environment variable `SEPAY_API_KEY` — never in database, never logged |
| Rotation | Rotate when SePay dashboard credentials change |
| CSRF exemption | `/api/payments/bank_transfer/webhook` added to `CSRF_EXEMPT` set in `proxy.ts` |

### 10.2 Data Exposure

| Data | Stored | Rationale |
|------|--------|-----------|
| SePay transaction ID | Yes (`providerTxnId`) | Required for idempotency and audit |
| Transfer amount | Yes (`amount`) | Required for amount guard |
| Transfer memo | Yes (`rawBody` in PaymentEvent) | Required for bookingRef extraction and audit |
| Sender name | **No** | PII — SePay payload may contain it; discarded by adapter |
| Sender account | **No** | PII — discarded by adapter |

### 10.3 Fraud Vectors

| Vector | Risk | Mitigation |
|--------|------|------------|
| Fake SePay webhook | HIGH if `SEPAY_API_KEY` leaked | Bearer token verification; key rotation; never log key |
| BookingRef enumeration | MEDIUM — attacker transfers small amounts with guessed bookingRefs | Amount guard (exact match required); bookingRef entropy: 36^8 ~ 2.8 trillion |
| Replay of SePay webhooks | LOW | `PaymentEvent @@unique([adapter, providerTxnId])` — P2002 on duplicate |

**Source:** ADR-008 D1, ADR-008 D7.

---

## 11. Interaction with Booking Lifecycle

### 11.1 Timing: SePay Webhook vs Hold Expiry

With SePay webhook (5-30s latency), the timing problem from the original DS-013 is largely resolved:

| Timeline | Event | Impact |
|----------|-------|--------|
| T+0 | Booking created, QR displayed | Seat reserved (hold) |
| T+1-3min | Customer scans QR, confirms transfer | Money leaves customer's account |
| T+1-3min | NAPAS processes transfer (instant domestic) | Money arrives in Agribank |
| T+1.5-3.5min | **SePay webhook fires** (5-30s after bank confirms) | `processPaymentWebhook` → booking paid |
| T+10min | Hold expires | Irrelevant — booking already in `paid` status |

**Contrast with original DS-013:** Under the cron design, the customer paid at T+1-3min but confirmation didn't arrive until T+30min (next cron cycle). The booking would expire at T+10min, creating a payment-after-expiry scenario requiring admin intervention. With SePay, confirmation arrives within the hold TTL window.

### 11.2 Edge Case: Slow SePay Webhook

If SePay webhook is delayed >10 minutes (SePay outage, network issue):

1. Hold expires → booking transitions to `payment_failed_expired`
2. SePay webhook arrives late → `applyPaidStatusTransition` guard fails (booking not in `awaiting_payment`)
3. `PaymentEvent` is still recorded (audit trail)
4. Admin manual reconciliation needed — same as the no-match case

This is a degraded-mode scenario. Under normal operation (SePay up, 5-30s latency), it does not occur.

---

## 12. Environment Configuration

| Variable | Default | Required | Purpose |
|----------|---------|----------|---------|
| `VIETQR_BANK_BIN` | `'970405'` | No (has default) | Agribank NAPAS BIN code |
| `VIETQR_ACCOUNT_NUMBER` | `'3516205005863'` | No (has default) | Receiving bank account |
| `VIETQR_ACCOUNT_NAME` | `'PLACEHOLDER'` | No (configure at deploy) | Account holder name displayed on QR page |
| `VIETQR_TEMPLATE` | `'compact2'` | No (has default) | VietQR image template |
| `SEPAY_API_KEY` | — | Yes when `PAYMENTS_STUB=false` | SePay webhook bearer token |

When `PAYMENTS_STUB=true`, bank transfer routes through the stub adapter (same as MoMo/VNPay) — no SePay credentials needed for local development.

---

## 13. Known Gaps

| Gap | Category | Risk | Required Before |
|-----|----------|------|----------------|
| SePay account setup + Agribank bank connection | Operations | CRITICAL — no webhook without SePay | Go-live |
| Backup reconciliation cron (paymentReconSweeper) | Feature | LOW — SePay webhook covers primary path | Post-launch |
| Admin manual reconciliation UI for unmatched transfers | Feature | MEDIUM — needed for ~5% edge cases | Post-launch |
| Refund flow for bank transfer overpayment | Feature | HIGH — no programmatic refund for bank transfers | Go-live (manual process documented) |
| Multi-bank support (accounts at multiple banks) | Feature | LOW at launch | Post-launch |
| VietQR image fallback when img.vietqr.io is down | Feature | LOW — manual transfer details shown as fallback | Post-launch |

---

## 14. Decision Log

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| R1 | ~~Poll-based reconciliation (cron) as primary~~ → **SePay webhook (push-based) as primary** | 2026-06-20 | SePay provides push-based webhook with 5-30s latency; eliminates 30-min cron delay; bank transfer becomes architecturally identical to MoMo/VNPay |
| R2 | ~~30-minute poll interval~~ → **No poll interval needed** | 2026-06-20 | Webhook is event-driven; no polling required for primary path |
| R3 | ~~ReconAttempt model required~~ → **Deferred to post-launch** | 2026-06-20 | SePay webhook reuses existing PaymentEvent model; ReconAttempt only needed if backup cron is built |
| R4 | Non-anchored **case-insensitive** regex for bookingRef extraction | 2026-06-20 | Banking apps may uppercase QR-prefilled memos; case-insensitive match with lowercase normalization handles this |
| R5 | ~~Exact amount match only~~ → **Reuse MoMo/VNPay amount guard** | 2026-06-20 | SePay webhook routes through same processPaymentWebhook pipeline; overpay auto-refund-out, underpay rejected |
| R6 | Agribank as receiving bank (BIN 970405) | 2026-06-20 | Most popular bank in Vietnam (40M+ accounts); best rural coverage for bus booking demographic; 0đ domestic transfer fees |
| R7 | SePay over Casso | 2026-06-20 | Simpler auth (bearer token vs HMAC); good Agribank coverage; cheaper |
| R8 | VietQR image via external API (img.vietqr.io) | 2026-06-20 | Free, no credentials, deterministic URL, EMVCo standard; no npm dependency |
| R9 | Discard sender PII from SePay payload | 2026-06-20 | Sender name and account not needed for matching; PII exposure under PDPL 2025 |
