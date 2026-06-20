# DS-008 -- ZaloPay Adapter Design

## 1. Overview

This document defines the ZaloPay payment adapter for the BusBooking platform -- a multi-tenant Vietnam bus booking marketplace. ZaloPay, embedded in Zalo (75M MAU, 20M+ active payment users), is the third PSP integration after bank transfer + cash (launch) and MoMo + VNPay (Month 1-3). ZaloPay targets the Zalo-native user segment that prefers in-app payment without switching to a separate banking or wallet app. Integration priority is **Phase 3 (Month 3-6 post-launch)**, following bank transfer + cash (Phase 1 launch) and MoMo + VNPay (Phase 2).

The adapter slots into the existing DS-005 webhook pipeline with no new cron jobs, no new state machine states, and no changes to the Booking or Hold lifecycle. The only additions are a new `PaymentAdapter` enum value, a webhook route, an order-creation function, and the associated HMAC verification logic.

**Source ADRs.** This document synthesizes decisions from ADR-005 (Payment Architecture), ADR-006 (Pricing/Currency), ADR-008 (Security Posture), ADR-009 (Concurrency/Seat-Holding), ADR-010 (Booking Lifecycle).

**Cross-references.** DS-001 (Data Model) for `PaymentEvent`, `Booking`, `Hold` entity schemas. DS-003 (API Contract) for route namespace and payment method selection. DS-005 (Webhook Design) for the 8-step inbound processing pipeline, HMAC defense stack, and idempotency contract. DS-006 (Background Jobs) for cron-based catch-up patterns.

---

## 2. ZaloPay AIO v2 API

### 2.1 Create Order

| Property | Value |
|----------|-------|
| Endpoint (sandbox) | `POST https://sb-openapi.zalopay.vn/v2/create` |
| Endpoint (production) | `POST https://openapi.zalopay.vn/v2/create` |
| Content-Type | `application/x-www-form-urlencoded` |
| Auth | HMAC SHA-256 using `key1` (order creation key) |

**Required fields:**

| Field | Type | Description |
|-------|------|-------------|
| `app_id` | int | Application ID assigned by ZaloPay |
| `app_user` | string | Customer identifier (use anonymized customer ID, not PII) |
| `app_trans_id` | string | Unique transaction ID, format: `YYMMDD_<bookingRef>` (max 40 chars) |
| `app_time` | long | Unix timestamp in milliseconds |
| `amount` | long | Payment amount in VND (integer, no conversion needed) |
| `item` | string | JSON array of item objects: `[{"name":"Bus ticket","quantity":1,"amount":<vnd>}]` |
| `description` | string | Human-readable description: `"BusBooking - <route> - <date>"` |
| `embed_data` | string | JSON object with return URL: `{"redirecturl":"<return_url>"}` |
| `bank_code` | string | Bank code or empty string for ZaloPay wallet |
| `mac` | string | HMAC SHA-256 signature |
| `callback_url` | string | Webhook URL: `https://<domain>/api/payments/zalopay/webhook` |

### 2.2 HMAC Signature for Order Creation

```
mac = HMAC-SHA256(key1, app_id|app_trans_id|app_user|amount|app_time|embed_data|item)
```

Pipe-delimited concatenation of field values (not keys). The `key1` secret is used for outbound order creation signatures.

### 2.3 app_trans_id Format

```
YYMMDD_<bookingRef>
```

- `YYMMDD`: date portion of order creation time (Vietnam timezone, UTC+7)
- `bookingRef`: the platform's booking reference (format: `BB-NNNN-xxxx-xxxx`, lowercase base36 per `lib/booking/bookingRef.ts`)
- Max length: 40 characters (ZaloPay constraint)
- Example: `260619_BB-2026-a1b2-c3d4`

The `app_trans_id` is stored as `providerOrderId` on the `PaymentEvent` for cross-referencing.

### 2.4 Create Order Response

| Field | Type | Description |
|-------|------|-------------|
| `return_code` | int | `1` = success, `2` = failed, `3` = processing |
| `return_message` | string | Human-readable message |
| `sub_return_code` | int | Detailed error code |
| `sub_return_message` | string | Detailed error message |
| `order_url` | string | URL to redirect customer for payment (only when `return_code === 1`) |
| `zp_trans_token` | string | ZaloPay transaction token |
| `order_token` | string | Token for ZaloPay JS SDK integration |

**Source:** ADR-005 D4.

---

## 3. HMAC Verification (Callback)

### 3.1 Callback Key

ZaloPay uses **two distinct keys**:

| Key | Purpose | Used In |
|-----|---------|---------|
| `key1` | Order creation signature | Outbound: `POST /v2/create` |
| `key2` | Callback verification | Inbound: webhook HMAC validation |

The keys rotate independently (SS7).

### 3.2 Callback Body Structure

```json
{
  "data": "{\"app_id\":1234,\"app_trans_id\":\"260619_BB-2026-a1b2-c3d4\",\"app_time\":1719792000000,\"app_user\":\"cust_clx1abc\",\"amount\":450000,\"embed_data\":\"{}\",\"item\":\"[...]\",\"zp_trans_id\":123456789,\"server_time\":1719792001000,\"channel\":1,\"merchant_user_id\":\"...\",\"user_fee_amount\":0,\"discount_amount\":0}",
  "mac": "a1b2c3d4e5f6...",
  "type": 1
}
```

- `data`: JSON-encoded string containing the payment result
- `mac`: HMAC SHA-256 of the `data` string using `key2`
- `type`: notification type (`1` = order payment, `2` = refund)

### 3.3 Verification Algorithm

```typescript
import { createHmac } from 'crypto';

function verifyZaloPayCallback(
  body: { data: string; mac: string; type: number },
  key2: string,
): boolean {
  const computedMac = createHmac('sha256', key2)
    .update(body.data)
    .digest('hex');
  return computedMac === body.mac;
}
```

**Timing-safe comparison:** The production implementation must use `crypto.timingSafeEqual` (Buffer comparison) instead of string `===` to prevent timing attacks. The `===` above is illustrative only.

```typescript
const computedBuf = Buffer.from(
  createHmac('sha256', key2).update(body.data).digest('hex'),
  'utf8',
);
const receivedBuf = Buffer.from(body.mac, 'utf8');
if (computedBuf.length !== receivedBuf.length) return false;
return crypto.timingSafeEqual(computedBuf, receivedBuf);
```

**Source:** ADR-008 D1 (HMAC verification layer), DS-005 SS4.1 (HMAC defense stack), Mistake Log Issue 010 (timingSafeEqual with valid-length buffers).

---

## 4. Webhook Handler

### 4.1 Route

`POST /api/payments/zalopay/webhook`

### 4.2 Pipeline

The ZaloPay webhook handler follows the same 8-step pipeline as MoMo and VNPay (DS-005 SS3.1):

```
ZaloPay callback POST
  |
  +-- 1. HMAC SHA-256 verification (key2)
  |     +-- FAIL -> HTTP 400
  |
  +-- 2. Zod schema validation (ZaloPayCallbackSchema)
  |     +-- FAIL -> HTTP 400
  |
  +-- 3. Adapter normalization
  |     +-- Parse data JSON string
  |     +-- Map return_code -> canonical status
  |     +-- Extract providerTxnId, amount, bookingRef
  |
  +-- 4. Booking lookup by bookingRef (from app_trans_id)
  |     +-- NOT FOUND -> HTTP 200 (no enumeration leak)
  |
  +-- 5. PaymentEvent INSERT (idempotent)
  |     +-- P2002 -> HTTP 200 (duplicate, no-op)
  |
  +-- 6. Status-dependent transition (same as DS-005)
  |     +-- paid: capacity guard, ledger, notification, e-invoice
  |     +-- failed: booking -> payment_failed_expired
  |     +-- pending: PaymentEvent recorded only
  |
  +-- 7. FunnelEvent('booking_paid') with gmvVnd
  |
  +-- 8. Post-commit via after():
        +-- Oversold refund (keyed 'oversold_race')
        +-- Overpay refund (keyed 'overpay_difference')
        +-- Notification dispatch
```

### 4.3 Middleware Configuration

| Property | Value |
|----------|-------|
| CSRF | Exempt (HMAC-authenticated; exact-match in middleware `Set`) |
| Rate limit | IP-based at Edge (same tier as MoMo/VNPay webhook routes) |
| Runtime | Origin (Node.js -- requires Prisma/DB access) |

The route path `/api/payments/zalopay/webhook` must be added to the CSRF exemption `Set` in `proxy.ts` (exact-match, not prefix-match per Mistake Log Issue 007).

### 4.4 Response Contract

| Condition | HTTP Status | Body |
|-----------|-------------|------|
| Invalid HMAC | 400 | `{ return_code: -1, return_message: "mac not equal" }` |
| All other cases | 200 | `{ return_code: 1, return_message: "success" }` |

ZaloPay expects `return_code: 1` for successful receipt. Non-200 responses trigger ZaloPay retry storms (same principle as DS-005 SS11.1).

**Source:** DS-005 SS2.1 (route table), DS-005 SS3.1 (8-step pipeline), Mistake Log Issue 007 (CSRF exact-match).

---

## 5. Adapter Normalization

### 5.1 Status Mapping

| ZaloPay `return_code` | Canonical Status | Booking Transition |
|-----------------------|------------------|--------------------|
| `1` | `paid` | `awaiting_payment -> paid` (full pipeline) |
| `2` | `failed` | `awaiting_payment -> payment_failed_expired` |
| `3` | `pending` | No transition (PaymentEvent recorded only) |

### 5.2 Normalized Output

```typescript
interface NormalizedPaymentEvent {
  adapter:       'zalopay';
  providerTxnId: string;          // zp_trans_id from callback data
  amount:        number;          // VND integer (no conversion needed)
  currency:      'VND';           // always VND
  status:        'paid' | 'failed' | 'pending';
  rawPayload:    Record<string, unknown>;  // full parsed data for audit
}
```

### 5.3 bookingRef Extraction

The `app_trans_id` field (format: `YYMMDD_<bookingRef>`) is split on the first `_` to extract the `bookingRef`:

```typescript
function extractBookingRef(appTransId: string): string {
  const idx = appTransId.indexOf('_');
  if (idx === -1) throw new Error('Invalid app_trans_id format');
  return appTransId.slice(idx + 1);
}
```

### 5.4 FAILURE_RESULT_CODES

ZaloPay failure codes are **not yet defined** in the acceptance criteria. Per Mistake Log Issue 004: enum/code-list constants that drive state-machine transitions must be sourced from the issue acceptance criteria verbatim, not augmented from upstream vendor docs. The `FAILURE_RESULT_CODES` set will be populated when the ZaloPay integration AC is written.

**Interim behavior:** Only `return_code: 2` maps to `failed`. Sub-codes (`sub_return_code`) are logged but do not drive state transitions until AC-specified.

**Source:** ADR-005 D4, ADR-019 D7, Mistake Log Issue 004 (FAILURE_RESULT_CODES from AC only).

---

## 6. Data Model Changes

### 6.1 PaymentAdapter Enum Extension

```prisma
enum PaymentAdapter {
  momo
  vnpay
  bank_transfer
  zalopay     // NEW
}
```

This is the only schema change. No new tables, no new columns on existing tables. The `PaymentEvent` model already supports the new adapter value via the enum:

```prisma
model PaymentEvent {
  // ... existing fields ...
  adapter       PaymentAdapter
  providerTxnId String
  // ...
  @@unique([adapter, providerTxnId])  // idempotency across all adapters
}
```

### 6.2 Migration

```sql
-- Migration: add zalopay to PaymentAdapter enum
ALTER TYPE "PaymentAdapter" ADD VALUE 'zalopay';
```

This is a non-destructive, online DDL change in PostgreSQL. No table rewrite, no downtime.

### 6.3 Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `ZALOPAY_APP_ID` | Application ID | Yes |
| `ZALOPAY_KEY1` | HMAC key for order creation | Yes |
| `ZALOPAY_KEY2` | HMAC key for callback verification | Yes |
| `ZALOPAY_ENDPOINT` | API base URL | Yes |

Validated at boot via `env.ts` Zod schema with `superRefine`:

```typescript
ZALOPAY_APP_ID: z.string().min(1),
ZALOPAY_KEY1: z.string().min(32, 'ZALOPAY_KEY1 must be at least 32 chars'),
ZALOPAY_KEY2: z.string().min(32, 'ZALOPAY_KEY2 must be at least 32 chars'),
ZALOPAY_ENDPOINT: z.string().url(),
```

### 6.4 Feature Gate

ZaloPay integration is behind a feature gate (`ZALOPAY_ENABLED=true`) until sandbox approval and production go-live:

- When disabled: ZaloPay does not appear in customer payment method selection
- When disabled: Webhook route still responds to callbacks (processes any in-flight payments) but no new orders are created
- Toggled via environment variable, no code deploy needed

**Source:** DS-001 (PaymentEvent schema), DS-005 SS4.1 (secret length enforcement).

---

## 7. Secret Rotation

### 7.1 Rotation Pattern

Same pattern as MoMo/VNPay in DS-005 SS4.2:

| Phase | Duration | Behavior |
|-------|----------|----------|
| Deploy new key | 0 min | New env var deployed; old key still active in ZaloPay dashboard |
| Grace period | 5 minutes | Webhook verification: try `key2_new` first, fall back to `key2_old` |
| Invalidate old key | After grace | Remove old key from ZaloPay dashboard; old env var removed |

### 7.2 Independent Rotation

| Key | Rotation Cadence | Scope |
|-----|-----------------|-------|
| `ZALOPAY_KEY1` | 90 days | Order creation only (outbound) |
| `ZALOPAY_KEY2` | 90 days | Callback verification only (inbound) |

The keys rotate independently. Rotating `key1` does not affect in-flight callback verification, and vice versa.

### 7.3 Grace Period Implementation

```typescript
function verifyWithGrace(data: string, mac: string): boolean {
  // Try current key first
  if (verifyHmac(data, mac, env.ZALOPAY_KEY2)) return true;
  // Fall back to previous key during rotation
  if (env.ZALOPAY_KEY2_PREVIOUS && verifyHmac(data, mac, env.ZALOPAY_KEY2_PREVIOUS)) {
    logger.info('zalopay.hmac.grace_period_hit', { key: 'key2_previous' });
    return true;
  }
  return false;
}
```

`ZALOPAY_KEY2_PREVIOUS` is an optional env var, only set during the 5-minute rotation grace window.

**Source:** DS-005 SS4.2 (secret rotation), ADR-008 D1.

---

## 8. Settlement Terms

### 8.1 ZaloPay Settlement Cycle

| Property | Value |
|----------|-------|
| Settlement period | T+1 to T+2 |
| Settlement currency | VND |
| Settlement method | Bank transfer to registered merchant account |

### 8.2 Alignment with Platform Model

The platform's existing settlement model is T+1 (operator payout eligible at `trip.completedAt + 1 day`). ZaloPay's T+1 to T+2 settlement aligns with this model:

- ZaloPay settles funds to the platform's merchant bank account at T+1 to T+2
- Platform holds funds until trip completion + T+1 (payout eligibility)
- No special handling needed -- the platform's payout cron already accounts for T+1 delay

The worst-case scenario (ZaloPay settles at T+2 but trip completes and operator requests payout at T+1) is handled by the platform's cash reserve. This is the same risk profile as MoMo (T+1 to T+2 settlement).

**Source:** ADR-005 D3 (T+1 settlement), DS-005 SS10 (timing constants).

---

## 9. Sandbox vs Production

### 9.1 Endpoint Configuration

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://sb-openapi.zalopay.vn/v2/` |
| Production | `https://openapi.zalopay.vn/v2/` |

### 9.2 Environment Validation

Same pattern as DS-005 SS11 (env validation): reject sandbox credentials in production.

```typescript
// In env.ts superRefine
if (process.env.NODE_ENV === 'production') {
  if (ZALOPAY_ENDPOINT.includes('sb-openapi')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ZALOPAY_ENDPOINT must not use sandbox URL in production',
    });
  }
}
```

### 9.3 Sandbox Limitations

| Limitation | Impact |
|------------|--------|
| Sandbox approval | 3-5 business days after application |
| Test amounts | Specific test amounts required (e.g., 50000 VND) |
| Callback delays | May be delayed up to 30 seconds in sandbox |
| No real money | Cannot test actual settlement flow |

### 9.4 Stub Gateway (Local Development)

When `PAYMENTS_STUB=true` (local development mode), the ZaloPay adapter uses the same local stub gateway as MoMo and VNPay. The stub:

- Returns a mock `order_url` pointing to a local callback simulator
- Simulates callback delivery after a configurable delay
- Supports `return_code: 1` (success), `2` (failure), `3` (pending) via query parameter

**Source:** DS-005 SS11 (sandbox validation), Memory: payment-deferral-strategy.md (PAYMENTS_STUB).

---

## 10. Integration with Existing Systems

### 10.1 DS-005 Webhook Pipeline

ZaloPay plugs into the existing webhook pipeline with zero changes to shared infrastructure:

| Pipeline Step | Reused As-Is | ZaloPay-Specific |
|---------------|-------------|------------------|
| 1. HMAC verification | Pattern reused | SHA-256 with `key2` (same algo as MoMo) |
| 2. Zod validation | Pattern reused | `ZaloPayCallbackSchema` (new schema) |
| 3. Adapter normalization | Interface reused | `zalopayAdapter.normalize()` (new implementation) |
| 4. Booking lookup | Fully reused | No change |
| 5. PaymentEvent INSERT | Fully reused | `adapter: 'zalopay'`, new enum value |
| 6. Status transition | Fully reused | No change |
| 7. FunnelEvent | Fully reused | `adapter: 'zalopay'` label |
| 8. Post-commit (after()) | Fully reused | No change |

### 10.2 DS-003 API Contract

Payment method selection in the hold/booking flow gains a new option:

```typescript
type PaymentMethod = 'momo' | 'vnpay' | 'bank_transfer' | 'zalopay';
```

The `POST /api/holds` and `POST /api/bookings/initiate` endpoints already accept a `paymentMethod` field. Adding `'zalopay'` to the Zod enum is the only change.

### 10.3 DS-006 Background Jobs

No new cron jobs are needed. ZaloPay uses the same webhook-driven flow as MoMo and VNPay. Existing crons that interact with ZaloPay payments:

| Cron | Interaction |
|------|-------------|
| `holdExpiry` | Expires holds regardless of payment method |
| `notificationDispatch` | Dispatches notifications for ZaloPay payments (same as others) |
| `einvoiceSubmission` | Submits e-invoices for ZaloPay-paid bookings (same as others) |
| `paymentReconSweeper` | Not applicable (ZaloPay has webhooks; bank transfer also uses SePay webhook) |
| `refundRetry` | Picks up failed ZaloPay refunds (when DS-007 ZaloPay refund is implemented) |

### 10.4 Customer Payment Method Selection

ZaloPay appears alongside existing payment methods in the customer-facing UI:

| Method | Icon | Label (Vietnamese) | Label (English) | Available |
|--------|------|-----------------------|------------------|-----------|
| Bank transfer | Building2 icon | Chuyển khoản | Bank Transfer | Launch (Phase 1) |
| Cash | Cash icon | Thanh toán khi lên xe | Cash at boarding | Launch (Phase 1) |
| MoMo | MoMo logo | Ví MoMo | MoMo Wallet | Phase 2 |
| VNPay | VNPay logo | VNPay | VNPay | Phase 2 |
| ZaloPay | ZaloPay logo | Ví ZaloPay | ZaloPay Wallet | Phase 3 |

Selection is gated by `ZALOPAY_ENABLED` feature flag (SS6.4).

**Source:** DS-003 (API contract), DS-005 (webhook pipeline), DS-006 (background jobs).

---

## 11. Order Creation Flow

### 11.1 Sequence

```
Customer            Frontend           API                    ZaloPay
   |                   |                |                       |
   |--select ZaloPay-->|                |                       |
   |                   |--POST /holds-->|                       |
   |                   |<--holdId-------|                       |
   |                   |                |                       |
   |--confirm--------->|                |                       |
   |                   |--POST          |                       |
   |                   |  /bookings     |                       |
   |                   |  /initiate---->|                       |
   |                   |                |--POST /v2/create----->|
   |                   |                |<--{order_url}---------|
   |                   |<--{paymentUrl}-|                       |
   |                   |                |                       |
   |--redirect-------->|--------------->|                       |
   |                   |          [customer pays in ZaloPay]    |
   |                   |                |                       |
   |                   |                |<--callback (IPN)------|
   |                   |                |  [8-step pipeline]    |
   |                   |                |--200 {return_code:1}->|
   |                   |                |                       |
   |<--redirect (return_url)------------|                       |
   |                   |                |                       |
```

### 11.2 Payment URL Generation

After `POST /api/bookings/initiate` with `paymentMethod: 'zalopay'`:

1. Create booking with `status: 'awaiting_payment'`
2. Call ZaloPay `POST /v2/create` with booking details
3. If `return_code === 1`: return `order_url` as `paymentUrl` to frontend
4. If `return_code !== 1`: log error, return payment creation failure to frontend (booking remains `awaiting_payment`, hold TTL applies)

### 11.3 Return URL Handling

After the customer completes payment in ZaloPay, their browser is redirected to the platform's return URL. Unlike VNPay (which sends payment result in return URL query params), ZaloPay's return URL is informational only -- the authoritative payment confirmation comes via the callback (IPN).

The return URL page:
- Shows "Payment processing..." while the callback is in flight
- Polls or subscribes for booking status update
- Displays booking confirmation once `status === 'paid'`

---

## 12. Testing Strategy

### 12.1 Unit Tests

| Test | Coverage |
|------|----------|
| HMAC verification with valid key2 | Correct mac passes |
| HMAC verification with invalid mac | Returns false, HTTP 400 |
| HMAC verification with wrong-length buffer | timingSafeEqual handles correctly |
| Adapter normalization: return_code 1 | Maps to `paid` |
| Adapter normalization: return_code 2 | Maps to `failed` |
| Adapter normalization: return_code 3 | Maps to `pending` |
| bookingRef extraction from app_trans_id | Correct split on first `_` |
| Order creation HMAC signing | Correct key1 signature |

### 12.2 Integration Tests

| Test | Coverage |
|------|----------|
| Full webhook pipeline: paid callback | PaymentEvent created, booking transitions, ledger written |
| Duplicate callback (idempotency) | P2002 caught, HTTP 200, no double-transition |
| Amount mismatch (underpay) | PaymentEvent recorded, no booking transition |
| Overpay callback | Booking transitions, overpay refund queued |
| Oversold race | Booking transitions to refunded, refund queued |

### 12.3 Mock Test Data

Per Mistake Log Issue 010: test values passed to `Buffer.from(s, 'hex')` must be hex-valid strings of the expected byte-width (64 chars for SHA-256):

```typescript
const MOCK_KEY2 = 'a'.repeat(64);           // valid 32-byte hex key
const MOCK_WRONG_KEY = 'b'.repeat(64);      // different valid 32-byte hex key
```

**Source:** Mistake Log Issue 010 (timingSafeEqual with valid-length buffers).

---

## 13. Known Gaps

| Gap | Dependency | Priority |
|-----|------------|----------|
| ZaloPay refund API integration | DS-007 (Refund Flow) -- follow same adapter pattern when ZaloPay refund endpoint is available | P2 |
| ZaloPay Mini Program integration (embedded booking inside Zalo app) | Zalo Mini App platform approval + separate frontend build | P3 (Phase 3+) |
| Exact `FAILURE_RESULT_CODES` set | Must come from ZaloPay integration AC spec verbatim (per Mistake Log Issue 004) -- DO NOT augment from vendor docs | Blocker for production |
| ZaloPay sandbox approval timeline | Typically 3-5 business days; must complete before integration testing | Pre-integration |
| ZaloPay query order API (order status check) | Needed for `paymentReconSweeper`-style reconciliation if callbacks are missed | P3 |
| ZaloPay agreement signing | Business agreement with ZaloPay required before production credentials issued | Pre-launch |
| Dual-key rotation automation | Currently manual (env var swap); could be automated via secrets manager | P3 |

**Source:** ADR-005 Context, Mistake Log Issue 004 (FAILURE_RESULT_CODES discipline).
