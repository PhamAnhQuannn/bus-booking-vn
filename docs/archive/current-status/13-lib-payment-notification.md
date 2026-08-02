# 13 -- lib/payment/ and lib/notification/

Status snapshot as of 2026-06-21.

---

## 1. lib/payment/ -- Payment Domain

### 1.1 File Inventory

| File | Purpose |
|------|---------|
| `gateway.ts` | Abstract `PaymentGateway` interface and canonical types |
| `select.ts` | Gateway selector -- maps `OnlinePaymentMethod` to an adapter |
| `applyPaidTransition.ts` | Shared paid-status transition + ledger append |
| `processWebhook.ts` | Gateway-agnostic IPN handler (HMAC verify, status update, notifications) |
| `refund.ts` | PSP refund dispatch (stub or real) |
| `adapters/momo.ts` | MoMo e-wallet adapter |
| `adapters/vnpay.ts` | VNPay domestic card / ATM adapter |
| `adapters/stub.ts` | Local fake-gateway adapter for dev/test |
| `index.ts` | Domain barrel -- re-exports public API |

### 1.2 gateway.ts -- Core Abstractions

Defines the provider-agnostic contract that all payment adapters implement.

#### Types

| Type | Fields | Description |
|------|--------|-------------|
| `CreatePaymentInput` | `orderId`, `amount`, `orderInfo`, `ipnUrl`, `redirectUrl`, `requestId`, `clientIp?` | Input for creating a payment URL |
| `CreatePaymentResult` | `{ ok: true, payUrl, externalRef }` or `{ ok: false, error }` | Discriminated union result |
| `CanonicalPaymentStatus` | `'paid' \| 'failed' \| 'pending' \| 'unknown'` | Normalized status across all gateways |
| `CanonicalPaymentEvent` | `orderRef`, `providerTxnId`, `amount`, `currency`, `status` | Normalized IPN event |
| `VerifyWebhookResult` | `{ ok: true, event }` or `{ ok: false, reason }` | Signature verification result |

#### PaymentGateway Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `createPayment` | `(input: CreatePaymentInput) => Promise<CreatePaymentResult>` | Builds gateway payment URL, returns payUrl + externalRef |
| `verifyWebhook` | `(rawBody: string) => VerifyWebhookResult` | Verifies IPN signature, returns normalized event |

Native gateway field names never leak past the adapter boundary. All adapters map their native result codes into `CanonicalPaymentStatus`.

### 1.3 select.ts -- Gateway Selection

| Export | Type | Description |
|--------|------|-------------|
| `OnlinePaymentMethod` | `'momo' \| 'zalopay' \| 'card' \| 'vnpay'` | Supported online payment methods |
| `getGatewayFor(method, baseUrl)` | `=> PaymentGateway` | Resolves the adapter for a method |

Selection logic:

| Method | `PAYMENTS_STUB=false` | `PAYMENTS_STUB=true` |
|--------|-----------------------|----------------------|
| `momo` | Real MoMo adapter | Stub adapter |
| `vnpay` | Real VNPay adapter | Stub adapter |
| `zalopay` | Stub (no real adapter yet) | Stub adapter |
| `card` | Stub (no real adapter yet) | Stub adapter |

`baseUrl` is required because the stub adapter points the browser at the local `/dev/stub-pay` page.

### 1.4 applyPaidTransition.ts -- Paid Status Transition

Two exported functions that encapsulate the monotonic booking-paid effect:

#### applyPaidStatusTransition(tx, bookingId, providerTxnId) => PaidTransitionResult

| Field | Type | Description |
|-------|------|-------------|
| `updated` | `number` | `1` on the first paid transition; `0` on replay / already-advanced |
| `refundTriggered` | `boolean` | `true` if trip is oversold after this transition (Issue 100) |

Sequence:
1. `UPDATE "Booking" SET status='paid'` guarded by `WHERE status IN legalPredecessors('paid')`.
2. If 0 rows updated -- replay/already-advanced, return `{ updated: 0, refundTriggered: false }`.
3. Lock the Trip row `FOR UPDATE` to serialize concurrent paid transitions (Issue 011 TOCTOU rule).
4. Count paid/completed seats under the lock. Only `paid`/`completed` bookings count (not holds or awaiting_payment -- prevents refund-oracle attack).
5. If SUM > capacity -- update booking to `refunded` + `refundedAt = NOW()` in same tx, return `{ updated: 1, refundTriggered: true }`.
6. Otherwise return `{ updated: 1, refundTriggered: false }`.

Shared by both `processWebhook` (payment webhook) and the reconciliation sweeper (`lib/jobs/reconcilePayments.ts`) so the two paid paths never drift (Issue 095).

#### appendBookingPaidLedger(tx, input)

Appends two double-entry ledger rows inside the caller's transaction:

| Entry | Type | Amount |
|-------|------|--------|
| `booking_credit` | Credit | `+gross` (full fare to operator) |
| `platform_fee` | Debit | `-fee` (platform's cut) |

Fee rate is resolved via `getEffectiveFeeRate(operatorId, now, tx)`. All currency math uses `BigInt` (ES2017 -- `BigInt()` constructor, no literal syntax). Idempotent via per-booking `sourceEventId`s (`booking_credit:<bookingId>`, `platform_fee:<bookingId>`).

### 1.5 processWebhook.ts -- IPN Handler

`processPaymentWebhook(input: ProcessPaymentWebhookInput) => Promise<Response>`

| Input Field | Type | Description |
|-------------|------|-------------|
| `rawBody` | `string` | Raw IPN body from the gateway |
| `gateway` | `PaymentGateway` | Adapter instance for signature verification |
| `adapter` | `string` | Gateway label (`'momo'`, `'vnpay'`, `'card'`) |
| `proto` | `string` | `x-forwarded-proto` header (for SMS confirmation URL) |
| `host` | `string` | `host` header (for SMS confirmation URL) |

#### Processing Sequence

1. **HMAC verification** -- `gateway.verifyWebhook(rawBody)`. Returns 400 `INVALID_SIGNATURE` on failure.
2. **Booking lookup** -- by `bookingRef`. Returns 200 no-op if not found (prevents enumeration).
3. **Transaction** -- `prisma.$transaction`:
   - INSERT `PaymentEvent` (idempotent via `@@unique([adapter, providerTxnId])`; P2002 conflict returns 200 no-op).
   - Status-dependent handling:

| Canonical Status | Action |
|------------------|--------|
| `paid` + currency != VND | Log `currency_mismatch`, no transition |
| `paid` + amount < totalVnd | Log `amount_mismatch` (money-loss guard), no transition |
| `paid` + amount >= totalVnd | Guarded transition via `applyPaidStatusTransition` |
| `paid` + amount > totalVnd | Mark paid, flag overpay delta for post-commit refund (Issue 051) |
| `failed` | Transition to `payment_failed_expired` via `legalPredecessors` |
| `pending` | Log only, no transition |
| `unknown` | PaymentEvent row recorded, no transition |

4. **Paid success path** (when `updated > 0` and `refundTriggered === false`):
   - Append ledger entries via `appendBookingPaidLedger`.
   - Enqueue two `NotificationLog` rows (status=`'pending'`): `customerBookingPaid` (SMS to buyer) and `operatorNewBooking` (SMS to operator).
   - Custom pickup detail folded into operator SMS payload (Issue 111).
5. **Oversold path** (when `refundTriggered === true`):
   - Booking already set to `refunded` inside the transaction.
   - Ledger entries still appended.
   - Oversold refund captured for post-commit `after()`.
6. **Post-commit** (via `after()`):
   - Overpay refund via `refundOut` with idempotency key `overpay:<bookingId>:<providerTxnId>`.
   - Oversold refund via `refundOut` with idempotency key `oversold:<bookingId>:<providerTxnId>`.
   - Analytics event `booking_paid` with GMV context (Issue 063).
7. **Return** 200 `{ message: 'ok' }`.

Notifications are NOT dispatched in-process. They are enqueued as `pending` rows; the `/api/cron/dispatch-notifications` cron delivers them with retry + backoff (Issue 058).

### 1.6 refund.ts -- PSP Refund Dispatch

| Export | Description |
|--------|-------------|
| `RefundPaymentInput` | `{ providerTxnId, amountMinor, idempotencyKey }` |
| `RefundPaymentResult` | `{ ok: true, refundTxnId }` |
| `PspRefundNotImplementedError` | Error thrown when real PSP refund is attempted before Issue 094 |
| `refundPayment(input)` | Dispatches refund -- stub or real |

Branching:
- `PAYMENTS_STUB=true` -- deterministic stub refund via `refundPaymentStub` (always succeeds).
- `PAYMENTS_STUB=false` -- throws `PspRefundNotImplementedError` (real PSP refund deferred to Issue 094 go-live).

### 1.7 adapters/momo.ts -- MoMo Adapter

| Export | Description |
|--------|-------------|
| `MomoConfig` | `{ partnerCode, accessKey, secretKey, endpoint }` |
| `createMomoAdapter(config, fetchFn?)` | Factory with injectable fetch for tests |
| `getMomoAdapter()` | Singleton from `getEnv()` |
| `_resetMomoAdapter()` | Test helper -- clears cached singleton |

**Signature algorithm:** HMAC-SHA256 over alphabetically-sorted canonical string of all fields except `signature`, joined with `&`.

**Result code classification** (from Issue 004 AC -- never augmented from upstream MoMo docs):

| Result Code | Canonical Status |
|-------------|------------------|
| `0` | `paid` |
| `1001, 1002, 1003, 1004, 1005, 4100` | `failed` |
| `9000, 1000` | `pending` |
| All others | `unknown` |

Security: `crypto.timingSafeEqual` for constant-time HMAC comparison. Length guard prevents throw on different-length signatures. Never logs `secretKey` or raw webhook body. MoMo IPN carries no currency field -- VND by construction.

### 1.8 adapters/vnpay.ts -- VNPay Adapter

| Export | Description |
|--------|-------------|
| `VnpayConfig` | `{ tmnCode, hashSecret, vnpUrl, returnUrl? }` |
| `createVnpayAdapter(config, fetchFn?)` | Factory with injectable fetch |
| `getVnpayAdapter()` | Singleton from `getEnv()` |
| `_resetVnpayAdapter()` | Test helper |

**Signature algorithm:** HMAC-SHA512 over alphabetically-sorted vnp_* fields (excluding `vnp_SecureHash` and `vnp_SecureHashType`), joined with `&`. Sign data uses RAW values; URL query string uses URL-encoded values.

**Result code classification:**

| Response Code | Canonical Status |
|---------------|------------------|
| `00` | `paid` |
| `24, 51, 65, 75, 11, 12, 13` | `failed` |
| `01, 02` | `pending` |
| All others | `unknown` |

`verifyWebhook` accepts URL-encoded form data (POST body or GET query string), not JSON. VNPay amounts are in VND * 100 -- the adapter divides by 100 before returning. `vnp_TransactionStatus` is the IPN-authoritative field; falls back to `vnp_ResponseCode` for the return-URL flow.

`createPayment` builds a `createDate` in Vietnam time (UTC+7). `vnp_IpnUrl` is required by VNPay v2.1.0; falls back to `VNPAY_IPN_URL` env var.

### 1.9 adapters/stub.ts -- Local Fake Gateway

| Export | Description |
|--------|-------------|
| `StubOutcome` | `'success' \| 'fail'` |
| `buildStubIpn(input)` | Builds a fully-signed stub IPN payload |
| `createStubAdapter(config)` | Factory for a specific gateway label |
| `getStubAdapter(adapter, baseUrl)` | Singleton keyed by gateway label |
| `refundPaymentStub(input)` | Deterministic stub refund |
| `_resetStubAdapters()` | Test helper |
| `STUB_SUCCESS_CODE` / `STUB_FAILURE_CODE` | `0` / `99` |

Flow:
1. `createPayment()` returns a `payUrl` pointing to `/dev/stub-pay?adapter=...&orderId=...&amount=...&redirectUrl=...`.
2. The `/dev/stub-pay` page lets the tester click "Pay success" / "Pay fail".
3. The page signs a self-issued IPN with `STUB_PAYMENT_SECRET` (HMAC-SHA256) and feeds it through the same `processPaymentWebhook` path used by real gateways.
4. `verifyWebhook()` uses the same HMAC-SHA256 algorithm, keyed by `STUB_PAYMENT_SECRET`.

Idempotency: stub `transId` is deterministic -- `stub_${orderId}_${outcome}`. Stub refund `refundTxnId` is `stub_refund_${idempotencyKey}`.

### 1.10 index.ts -- Barrel Exports

```
getMomoAdapter, getVnpayAdapter
buildStubIpn, createStubAdapter, refundPaymentStub, StubOutcome
PaymentGateway, CreatePaymentInput
processPaymentWebhook
applyPaidStatusTransition, appendBookingPaidLedger
refundPayment
getGatewayFor, OnlinePaymentMethod
```

---

## 2. lib/notification/ -- Notification Domain

### 2.1 File Inventory

| File | Purpose |
|------|---------|
| `dispatchNotifications.ts` | Cron-driven outbox dispatcher with retry/backoff |
| `email.ts` | Email adapter (Resend or stub) |
| `esms.ts` | SMS templates, rendering, and dispatch |
| `esmsClient.ts` | eSMS.vn HTTP client |
| `index.ts` | Domain barrel |

### 2.2 dispatchNotifications.ts -- Outbox Dispatcher

`dispatchNotifications: JobCore` -- a cron job that delivers due `NotificationLog` rows.

#### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_ATTEMPTS` | `5` | Max delivery attempts before permanently failed |
| `BATCH_SIZE` | `50` | Rows claimed per cron tick |
| `BACKOFF_CAP_MINUTES` | `30` | Max backoff wait |

#### Exponential Backoff Schedule

| Attempt | Wait (minutes) |
|---------|----------------|
| 1 | 2 |
| 2 | 4 |
| 3 | 8 |
| 4 | 16 |
| 5 | 30 (capped) |

`backoffMs(attemptCount, now)` returns the `Date` of the next eligible attempt.

#### Claim-then-Dispatch Outbox Pattern

1. **Claim** -- short transaction with `FOR UPDATE SKIP LOCKED` to prevent concurrent dispatchers from grabbing the same row. Rows eligible: `status IN ('pending', 'failed')`, `attemptCount < MAX_ATTEMPTS`, `nextAttemptAt <= now` (or null), `scheduledFor <= now` (or null). Ordered by `createdAt ASC`.
2. **Dispatch** -- each claimed row sent via channel adapter OUTSIDE any transaction:
   - `channel = 'sms'` -- calls `sendSmsBody()` with `row.id` as the eSMS RequestId (idempotency key).
   - `channel = 'email'` -- calls `sendEmail()`.
3. **Persist outcome**:
   - Success: `status='sent'`, `sentAt=now`, `externalRef` from provider.
   - Failure: `attemptCount++`, `status='failed'`, `lastError` (truncated to 500 chars), `nextAttemptAt` set to backoff time.

A delivery failure updates ONLY the `NotificationLog` row. Booking status is never touched (AC5 decoupling).

The advisory lock (`'notify-dispatch'` key) serializes whole ticks. `SKIP LOCKED` is belt-and-suspenders for manual-trigger races.

### 2.3 email.ts -- Email Adapter

| Export | Description |
|--------|-------------|
| `EmailTemplate` | Union of all supported email template names |
| `SendEmailInput` | `{ to, template, payload }` |
| `SendEmailResult` | `{ ok, externalRef?, error? }` |
| `sendEmail(input)` | Dispatches email (stub, Resend, or error) |
| `renderEmailSubject(template)` | Maps template name to Vietnamese subject line |

#### EmailTemplate Values

| Template | Subject (Vietnamese) |
|----------|---------------------|
| `customerBookingPaid` | Xac nhan thanh toan |
| `operatorNewBooking` | Khach dat ve moi |
| `bookingReminder24h` | Nhac nho chuyen di |
| `payout_scheduled` | Lich chi tra |
| `trip_cancelled` | Chuyen di bi huy |
| `operatorPending` | Ho so dang ky dang duoc xem xet |
| `operatorApproved` | Tai khoan nha xe da duoc duyet |
| `operatorRejected` | Don dang ky can bo sung |
| `operatorSuspended` | Tai khoan nha xe da bi tam ngung |
| `operatorUnderReview` | Ho so nha xe dang duoc xem xet |
| `operatorResubmit` | Da nhan lai ho so nha xe |
| `operatorAccountCreated` | Tai khoan nha xe cua ban da san sang |
| `charterSubmitted` | Da nhan yeu cau thue xe |
| `charterMatched` | Da tim duoc nha xe cho yeu cau cua ban |
| `charterClaimWon` | Ban da nhan duoc yeu cau thue xe |
| `charterClaimLost` | Yeu cau thue xe da duoc nha xe khac nhan |
| `charterReturnedToReview` | Chung toi van dang tim nha xe cho ban |
| `ticketReady` | Ve dien tu cua ban da san sang |
| `charterDeclined` | Nha xe da tu choi yeu cau thue xe |

#### Dispatch Logic

| Condition | Behavior |
|-----------|----------|
| `NOTIFY_STUB !== 'false'` (default) | Deterministic stub success, no network I/O |
| `EMAIL_PROVIDER === 'resend'` | Real dispatch via Resend SDK (lazy-loaded) |
| Otherwise | Returns `ok: false, error: 'real_email_provider_not_wired'` |

Resend client is lazy-loaded to avoid importing the dependency in stub/dev mode. Uses `EMAIL_FROM` env var (defaults to `noreply@busbookvn.com`).

### 2.4 esms.ts -- SMS Templates and Dispatch

| Export | Description |
|--------|-------------|
| `SmsTemplate` | Union of all SMS template names |
| `renderTemplate(template, payload)` | Renders a template with payload substitution |
| `sendSms(input)` | Renders + dispatches an SMS |
| `sendSmsBody(input)` | Dispatches a pre-rendered SMS body |
| `getTestOtp(phone)` | Returns last OTP sent to phone (test-only, non-production) |
| `clearTestOtpSink()` | Clears test OTP sink |

#### SmsTemplate Values

| Template | Use Case |
|----------|----------|
| `bookingPendingCash` | Cash booking confirmation |
| `operatorNewBooking` | New booking notification to operator (includes custom pickup if present) |
| `customerBookingPaid` | Online payment confirmation to customer |
| `customerBookingExpired` | Reconciliation sweeper expiry notice (Issue 095) |
| `otpCode` | OTP verification code |
| `manualBookingPaid` | Operator-initiated paid booking |
| `manualBookingCash` | Operator-initiated cash booking |
| `staffTempPassword` | Staff account temporary password |
| `operatorAdminTempPassword` | Operator admin temporary password |
| `bookingReminder24h` | 24-hour departure reminder |

#### Dispatch Logic

| Condition | Behavior |
|-----------|----------|
| `NOTIFY_STUB !== 'false'` (default) | Stub dispatch -- logs only, no network. OTP codes stashed in `_testOtpSink` for e2e/dev via `/api/auth/otp/test-peek`. |
| `NOTIFY_STUB === 'false'` | Real eSMS dispatch via `postEsms()`. OTP uses `ESMS_OTP_SMSTYPE`; all others use CSKH type `'2'`. |

`sendSmsBody` is used by the notification dispatcher for pre-rendered bodies. `sendSms` is used for synchronous sends (OTP, etc.) where the template is rendered at call time.

Test OTP sink uses `globalThis` singleton pattern (same as `lib/core/db/client.ts`) to survive Next.js per-route-bundle isolation.

### 2.5 esmsClient.ts -- eSMS Provider Client

| Export | Description |
|--------|-------------|
| `postEsms(input)` | POSTs to eSMS API, returns `SendSmsResult` |
| `toEsmsPhone(e164)` | Converts `+84xxxxxxxxx` to `84xxxxxxxxx` |

**API endpoint:** `{ESMS_BASE_URL}/MainService.svc/json/SendMultipleMessage_V4_post_json/`

**Request body fields:** `ApiKey`, `SecretKey`, `Brandname`, `Phone`, `Content`, `SmsType`, `IsUnicode`, `RequestId` (idempotency key, max 50 chars), `Sandbox`.

**Response handling:**

| eSMS `CodeResult` | Outcome |
|-------------------|---------|
| `'100'` | `ok: true`, `externalRef` = `SMSID` |
| Any other | `ok: false`, error includes code + `ErrorMessage` |

Never throws. Timeout is 10 seconds via `AbortController`. Unicode detection is automatic (`IsUnicode: '1'` when body contains non-ASCII characters). Logs only non-sensitive fields -- never message content (may contain OTP) or recipient phone (PII).

### 2.6 index.ts -- Barrel Exports

```
getTestOtp, renderTemplate, sendSms, sendSmsBody
dispatchNotifications
sendEmail, renderEmailSubject
SendEmailInput, SendEmailResult, EmailTemplate
```

---

## 3. Payment Flow (End-to-End)

```
Customer selects payment method
        |
        v
getGatewayFor(method, baseUrl)          [select.ts]
  -> resolves MoMo / VNPay / Stub adapter
        |
        v
gateway.createPayment(input)            [adapters/*.ts]
  -> returns { payUrl, externalRef }
        |
        v
Customer redirected to payUrl
  (MoMo app / VNPay page / /dev/stub-pay)
        |
        v
Gateway sends IPN to /api/payments/{adapter}/webhook
        |
        v
processPaymentWebhook(input)            [processWebhook.ts]
  |
  +-- gateway.verifyWebhook(rawBody)     HMAC signature check
  |     fail -> 400 INVALID_SIGNATURE
  |
  +-- Booking lookup by bookingRef
  |     not found -> 200 no-op
  |
  +-- $transaction:
  |   +-- INSERT PaymentEvent (idempotent: P2002 -> 200)
  |   +-- Status routing:
  |   |   paid   -> currency guard -> amount guard -> applyPaidStatusTransition
  |   |   failed -> transition to payment_failed_expired
  |   |   pending/unknown -> no transition
  |   |
  |   +-- On paid (updated > 0):
  |       +-- appendBookingPaidLedger (booking_credit + platform_fee)
  |       +-- Oversold check (refundTriggered?)
  |       +-- Enqueue NotificationLog rows (customerBookingPaid + operatorNewBooking)
  |
  +-- Post-commit (after()):
  |   +-- Overpay refund via refundOut (if applicable)
  |   +-- Oversold refund via refundOut (if applicable)
  |   +-- Analytics: booking_paid event with GMV context
  |
  +-- Return 200 { message: 'ok' }
```

---

## 4. Notification Flow (Queue to Delivery)

```
Notifications enqueued by various producers:
  - processWebhook (booking paid)
  - cancelTrip (trip cancelled)
  - completeTripCore (payout scheduled)
  - ... other domain events

All enqueue as NotificationLog rows with status='pending'
        |
        v
/api/cron/dispatch-notifications (scheduled cron)
        |
        v
dispatchNotifications (JobCore)          [dispatchNotifications.ts]
  |
  +-- claimDueRows(now, BATCH_SIZE=50)
  |     SELECT ... WHERE status IN ('pending','failed')
  |       AND attemptCount < 5
  |       AND (nextAttemptAt IS NULL OR <= now)
  |       AND (scheduledFor IS NULL OR <= now)
  |     ORDER BY createdAt ASC
  |     FOR UPDATE SKIP LOCKED
  |
  +-- For each claimed row:
  |   +-- dispatchRow(row)
  |   |     channel='sms'   -> sendSmsBody()  [esms.ts]
  |   |     channel='email' -> sendEmail()    [email.ts]
  |   |
  |   +-- Success:
  |   |     UPDATE status='sent', sentAt=now, externalRef
  |   |
  |   +-- Failure:
  |         UPDATE status='failed', attemptCount++,
  |           lastError, nextAttemptAt = backoff(attempt)
  |         captureException for alerting
  |
  +-- Return { rowsAffected: delivered, status: 'success' }

Backoff: 2^N minutes (capped at 30min). After 5 attempts, row is permanently failed.
```

---

## 5. Test Files

### lib/payment/

| File | Type | Coverage |
|------|------|----------|
| `__tests__/momo.test.ts` | Unit | MoMo adapter: signature generation, verification, result code classification |
| `__tests__/stub.test.ts` | Unit | Stub adapter: IPN building, signature verification, createPayment URL |
| `__tests__/select.test.ts` | Unit | Gateway selector: method-to-adapter mapping, PAYMENTS_STUB branching |
| `__tests__/applyPaidTransition.oversold.int.test.ts` | Integration | Oversold race: concurrent paid transitions, capacity guard, refundTriggered flag |
| `__tests__/fixtures/momo-ipn-sample.json` | Fixture | Sample MoMo IPN payload |

### lib/notification/

| File | Type | Coverage |
|------|------|----------|
| `__tests__/dispatchNotifications.test.ts` | Unit | Dispatcher: claim logic, backoff, success/failure paths, batch limits |
| `__tests__/dispatchNotifications.int.test.ts` | Integration | End-to-end dispatch against live DB |
| `__tests__/email.test.ts` | Unit | Email adapter: stub dispatch, subject rendering, Resend path |
| `__tests__/esms.test.ts` | Unit | SMS templates: renderTemplate output, sendSms stub, OTP sink |
| `__tests__/esmsClient.test.ts` | Unit | eSMS HTTP client: request format, response parsing, timeout |

### E2E (Playwright)

| File | Coverage |
|------|----------|
| `e2e/stub-payment.spec.ts` | Stub gateway end-to-end payment flow |
| `e2e/momo-booking.spec.ts` | MoMo booking flow (uses stub when PAYMENTS_STUB=true) |

---

## 6. Key Design Decisions

| Decision | Detail |
|----------|--------|
| **Adapter pattern** | Native gateway fields never escape the adapter. All adapters normalize to `CanonicalPaymentEvent`. |
| **Idempotency** | `PaymentEvent @@unique([adapter, providerTxnId])` prevents duplicate IPN processing. Ledger entries idempotent on `sourceEventId`. Stub transId is deterministic. |
| **Monotonic transitions** | Status updates use `legalPredecessors()` from a single-source transition map. Never re-type status literals. |
| **Decoupled notifications** | Webhook enqueues `NotificationLog` rows; cron-driven dispatcher is the single delivery path. Delivery failure never affects booking status (AC5). |
| **PAYMENTS_STUB seam** | Entire site runs on local stub gateway in dev. Real PSP deferred to Issue 094 go-live. |
| **NOTIFY_STUB seam** | SMS/email stubbed by default. Real eSMS/Resend only when `NOTIFY_STUB=false`. |
| **BigInt currency math** | All minor-unit * fractional-rate multiplication uses `BigInt()` constructor (ES2017 target). |
| **Oversold defense** | Trip row locked `FOR UPDATE` during paid transition. Oversold booking immediately set to `refunded` inside same tx. Refund-out dispatched post-commit. |
| **No self-fetch** | processWebhook is called in-process by route handlers. Server components use lib functions directly, never self-fetch. |
