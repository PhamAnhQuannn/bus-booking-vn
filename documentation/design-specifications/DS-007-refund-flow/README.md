# DS-007 -- Refund Flow Design

## 1. Overview

This document defines the end-to-end refund architecture for the BusBooking platform -- a multi-tenant Vietnam bus booking marketplace that must process refunds across multiple Vietnamese PSPs (MoMo, VNPay, VietQR), comply with Vietnam's Consumer Protection Law 2023, and maintain financial integrity through the append-only double-entry ledger. The refund flow is the reverse complement of the payment webhook pipeline: where DS-005 moves money inbound (PSP -> platform -> operator), this spec moves money outbound (platform -> PSP -> customer).

**Source ADRs.** This document synthesizes decisions from ADR-005 (Payment Architecture), ADR-006 (Pricing/Currency), ADR-010 (Booking Lifecycle), ADR-015 (Error Contract), ADR-019 (State Machines).

**Cross-references.** DS-001 (Data Model) for `Booking`, `PaymentEvent`, `LedgerEntry` entity schemas. DS-003 (API Contract) for route namespace table and error envelope format. DS-005 (Webhook Design) for inbound payment pipeline, idempotency key format, and refund trigger points (oversold race, overpay difference). DS-006 (Background Jobs) for cron-based retry patterns.

---

## 2. Refund Triggers

| # | Trigger | Initiator | Source | Conditions |
|---|---------|-----------|--------|------------|
| T1 | Customer self-cancel | Customer | Art. 29 Consumer Protection Law 2023 | Within 3 business days of booking creation AND before trip departure |
| T2 | Operator trip cancellation | System (on behalf of operator) | ADR-010 Booking Lifecycle | All `paid` bookings on a cancelled trip receive automatic refund |
| T3 | Oversold race | System (L2 capacity guard) | DS-005 SS6.3 | Webhook-time capacity recount exceeds trip capacity; booking transitions to `refunded` |
| T4 | Overpay difference | System (webhook pipeline) | DS-005 SS3.1 step 6 | Payment amount > `booking.totalVnd`; delta refunded post-commit |
| T5 | Admin manual refund | Admin | Dispute resolution, goodwill | Admin initiates via dashboard; requires reason + audit trail |

**Source:** ADR-005 D4, ADR-010 D7, Consumer Protection Law 2023 Art. 29.

---

## 3. Refund State Machine

### 3.1 State Diagram

```
                    +-----------+
                    |  refund   |
  (creation) ------>  requested |
                    +-----+-----+
                          |
                          v
                    +-----------+
                    | processing|
                    +-----+-----+
                          |
                   +------+------+
                   |             |
                   v             v
             +-----------+ +-----------+
             | completed | |  failed   |
             +-----------+ +-----+-----+
                                 |
                                 | retry (attempts < MAX_ATTEMPTS)
                                 v
                           +-----------+
                           | processing|
                           +-----------+
                                 |
                          +------+------+
                          |             |
                          v             v
                    +-----------+ +------------------+
                    | completed | | permanently      |
                    +-----------+ | _failed          |
                                  +------------------+
```

### 3.2 Legal Transitions

```typescript
const LEGAL_REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  refund_requested: ['processing'],
  processing:       ['completed', 'failed'],
  failed:           ['processing'],                  // retry
  completed:        [],                              // terminal
  permanently_failed: [],                            // terminal -- admin intervention required
};
```

### 3.3 Transition Rules

| From | To | Trigger | Guard |
|------|----|---------|-------|
| `refund_requested` | `processing` | Cron pickup or immediate dispatch | `attempts < MAX_ATTEMPTS` |
| `processing` | `completed` | PSP refund API returns success | PSP confirms refund processed |
| `processing` | `failed` | PSP refund API returns error or timeout | Record `failedReason` |
| `failed` | `processing` | Cron retry after backoff interval | `attempts < MAX_ATTEMPTS AND lastAttemptAt + backoff < NOW()` |
| `failed` | `permanently_failed` | Cron detects `attempts >= MAX_ATTEMPTS` | Admin notification dispatched |

Every transition executes inside `prisma.$transaction(async (tx) => { ... })` with a leading `tx.$queryRaw\`SELECT id FROM "Refund" WHERE id = ${id} FOR UPDATE\`` to serialize concurrent state changes on the same refund row.

**Source:** ADR-019 D7 (state machine discipline), Mistake Log Issue 011 (FOR UPDATE inside $transaction).

---

## 4. Data Model

### 4.1 Refund Entity

```prisma
model Refund {
  id              String         @id @default(cuid())
  bookingId       String
  paymentEventId  String
  amount          Int            // VND integer, no decimals (BigInt arithmetic for computation)
  reason          RefundReason
  status          RefundStatus   @default(refund_requested)
  idempotencyKey  String         @unique
  pspRefundId     String?        // PSP-assigned refund transaction ID (set on completion)
  attempts        Int            @default(0)
  lastAttemptAt   DateTime?
  completedAt     DateTime?
  failedReason    String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  booking         Booking        @relation(fields: [bookingId], references: [id])
  paymentEvent    PaymentEvent   @relation(fields: [paymentEventId], references: [id])

  @@index([status, lastAttemptAt])   // cron pickup query
  @@index([bookingId])               // customer refund lookup
}

enum RefundReason {
  customer_cancel
  trip_cancel
  oversold
  overpay
  admin_manual
}

enum RefundStatus {
  refund_requested
  processing
  completed
  failed
  permanently_failed
}
```

### 4.2 Idempotency Key Format

Idempotency keys prevent duplicate refund creation. Format follows DS-005 conventions:

| Trigger | Key Format | Example |
|---------|------------|---------|
| Customer self-cancel | `cancel:<tripId>:<bookingId>` | `cancel:clx1abc:clx2def` |
| Operator trip cancel | `trip_cancel:<tripId>:<bookingId>` | `trip_cancel:clx1abc:clx2def` |
| Oversold race | `oversold_race:<bookingId>` | `oversold_race:clx2def` |
| Overpay difference | `overpay_difference:<bookingId>` | `overpay_difference:clx2def` |
| Admin manual | `admin_manual:<bookingId>:<timestamp>` | `admin_manual:clx2def:1719792000` |

The `@@unique([idempotencyKey])` constraint ensures that a Prisma `P2002` violation on insert is caught and treated as a no-op (same pattern as `PaymentEvent @@unique([adapter, providerTxnId])`).

**Source:** DS-005 SS3.1 step 5, DS-001 entity schemas.

### 4.3 Indexes

| Index | Purpose | Query Pattern |
|-------|---------|---------------|
| `@@index([status, lastAttemptAt])` | Cron batch pickup | `WHERE status = 'failed' AND lastAttemptAt < NOW() - backoff` |
| `@@unique([idempotencyKey])` | Duplicate prevention | INSERT guard (P2002 catch) |
| `@@index([bookingId])` | Customer-facing refund list | `WHERE bookingId IN (customer's bookings)` |

---

## 5. PSP Refund API Integration

### 5.1 Adapter Interface

Each PSP adapter implements a common refund interface:

```typescript
interface RefundAdapter {
  readonly adapter: PaymentAdapter;  // 'momo' | 'vnpay' | 'bank_transfer' | 'zalopay'
  submitRefund(params: RefundSubmitParams): Promise<RefundSubmitResult>;
}

interface RefundSubmitParams {
  refundId:       string;
  originalOrderId: string;          // bookingRef used as PSP orderId
  providerTxnId:  string;           // original PaymentEvent.providerTxnId
  amount:         number;           // VND integer
  reason:         string;           // human-readable reason for PSP
}

interface RefundSubmitResult {
  success:      boolean;
  pspRefundId?: string;             // PSP-assigned refund transaction ID
  failReason?:  string;
}
```

### 5.2 MoMo Refund (AIO v3)

| Property | Value |
|----------|-------|
| Endpoint | `POST https://payment.momo.vn/v2/gateway/api/refund` |
| Auth | HMAC SHA-256 (`secretKey`) |
| Required fields | `partnerCode`, `orderId` (original), `requestId` (unique per refund attempt), `amount`, `transId` (original MoMo transaction ID), `lang` |
| Signature input | `accessKey=$accessKey&amount=$amount&description=&orderId=$orderId&partnerCode=$partnerCode&requestId=$requestId&transId=$transId` |
| Success indicator | `resultCode === 0` |
| Partial refund | Supported (`amount` <= original transaction amount) |

### 5.3 VNPay Refund (v2.1.0)

| Property | Value |
|----------|-------|
| Endpoint | `POST https://sandbox.vnpayment.vn/merchant_webapi/api/transaction` (sandbox) |
| Auth | HMAC SHA-512 (`vnp_HashSecret`) |
| Required fields | `vnp_RequestId`, `vnp_Version` (2.1.0), `vnp_Command` (refund), `vnp_TmnCode`, `vnp_TxnRef` (original), `vnp_Amount` (VND x 100), `vnp_OrderInfo`, `vnp_TransactionDate` (original), `vnp_CreateBy` (admin identifier), `vnp_CreateDate`, `vnp_IpAddr` |
| Signature input | Pipe-delimited concatenation of all fields in order, HMAC SHA-512 |
| Success indicator | `vnp_ResponseCode === '00'` |
| Partial refund | Supported (`vnp_Amount` <= original `vnp_Amount`, value is VND x 100 per VNPay convention) |
| Note | VNPay amounts are VND x 100 at the API layer; the adapter handles conversion to/from platform integer VND |

### 5.4 Bank Transfer (Manual)

| Property | Value |
|----------|-------|
| Refund method | Manual bank transfer by admin |
| API | None -- bank transfer (VietQR + SePay) has no programmatic refund endpoint |
| Flow | Admin initiates manual transfer via bank portal, then marks refund as `completed` in admin dashboard |
| Guard | Only admin role can transition bank transfer refunds to `completed` |

### 5.5 Partial vs Full Refund

| Type | Condition | Amount |
|------|-----------|--------|
| Full refund | `refund.amount === paymentEvent.amount` | Original payment amount |
| Partial refund | `refund.amount < paymentEvent.amount` | Specified amount (after cancellation fee deduction) |

Guard: `refund.amount` must satisfy `0 < amount <= paymentEvent.amount`. Enforced at creation time via Zod validation.

**Source:** ADR-005 D4, DS-005 SS15 (PSP comparison matrix).

---

## 6. API Endpoints

### 6.1 Route Table

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/bookings/{id}/cancel` | POST | Customer JWT | Customer-initiated cancellation + refund |
| `/api/customers/me/refunds` | GET | Customer JWT | List customer's refunds (paginated) |
| `/api/admin/refunds` | GET | Admin JWT | Admin refund list with status/reason filters |
| `/api/admin/refunds/{id}/retry` | POST | Admin JWT | Admin retry of a failed refund |
| `/api/admin/refunds/{id}/complete` | POST | Admin JWT | Admin manual completion (bank transfer) |

### 6.2 Customer Cancel Endpoint

`POST /api/bookings/{id}/cancel`

**Request:** Empty body (booking ID in URL path).

**Guards (in order):**

1. Customer JWT authentication (via `requireCustomerAuth`)
2. Booking ownership: `booking.customerId === jwt.sub`
3. Booking status: must be `paid` (cannot cancel `awaiting_payment`, `completed`, `cancelled`, `no_show`, `refunded`)
4. Art. 29 window: `booking.createdAt + 3 business days > NOW()` AND `trip.departureAt > NOW()`
5. Idempotency: if booking already `cancelled`, return discriminated result `{ booking, refund: null, alreadyCancelled: true }` with HTTP 200

**Response (success):**

```json
{
  "booking": { "id": "...", "status": "cancelled", "cancelledAt": "..." },
  "refund": { "id": "...", "amount": 450000, "status": "refund_requested", "reason": "customer_cancel" },
  "alreadyCancelled": false
}
```

**Response (already cancelled -- idempotent):**

```json
{
  "booking": { "id": "...", "status": "cancelled", "cancelledAt": "..." },
  "refund": null,
  "alreadyCancelled": true
}
```

**Error responses:**

| Condition | HTTP | Error code |
|-----------|------|------------|
| Booking not found / not owned | 404 | `booking_not_found` |
| Booking not in `paid` status | 422 | `booking_not_cancellable` |
| Art. 29 window expired | 422 | `cancellation_window_expired` |
| Trip already departed | 422 | `trip_already_departed` |

The cancel endpoint uses a **discriminated result** pattern (not a thrown sentinel error) per Mistake Log Issue 013: the service returns `{ booking, refund, alreadyCancelled }` and the route always returns HTTP 200 for the already-cancelled path.

**Source:** ADR-015 D1 (error contract), Mistake Log Issue 013 (discriminated result pattern).

### 6.3 Customer Refund List

`GET /api/customers/me/refunds?page=1&limit=20`

Returns paginated refund list for the authenticated customer. Joins through `Refund -> Booking -> Customer` to enforce ownership. Response includes refund status, amount, reason, and creation date.

### 6.4 Admin Refund Retry

`POST /api/admin/refunds/{id}/retry`

**Guards:**
1. Admin JWT authentication
2. Refund status must be `failed` (not `permanently_failed` -- those require investigation first)
3. Resets `attempts` count to allow fresh retry cycle

### 6.5 Admin Manual Complete

`POST /api/admin/refunds/{id}/complete`

**Guards:**
1. Admin JWT authentication
2. Refund must be for bank transfer payment (manual transfer flow)
3. Admin provides `pspRefundId` (bank transfer reference) in request body
4. Transitions refund to `completed`, writes ledger entries

---

## 7. Cron: refundRetry

### 7.1 Job Configuration

| Property | Value |
|----------|-------|
| Job name | `refundRetry` |
| Schedule | Every 5 minutes |
| Batch size | 50 rows per invocation |
| Locking | `FOR UPDATE SKIP LOCKED` (concurrent-safe) |
| Max attempts | 5 |

### 7.2 Query

```sql
SELECT * FROM "Refund"
WHERE status = 'failed'
  AND attempts < 5
  AND "lastAttemptAt" < NOW() - INTERVAL '...'  -- backoff interval
FOR UPDATE SKIP LOCKED
LIMIT 50
```

### 7.3 Exponential Backoff Schedule

| Attempt | Backoff Interval | Cumulative Wait |
|---------|-----------------|-----------------|
| 1 | 5 minutes | 5 minutes |
| 2 | 15 minutes | 20 minutes |
| 3 | 1 hour | 1 hour 20 minutes |
| 4 | 4 hours | 5 hours 20 minutes |
| 5 | 24 hours | 29 hours 20 minutes |

Backoff formula: `BACKOFF_INTERVALS = [5*60, 15*60, 60*60, 4*60*60, 24*60*60]` (seconds). The cron checks `lastAttemptAt + BACKOFF_INTERVALS[attempts - 1] < NOW()` before picking up a row.

### 7.4 Terminal Failure

After 5 failed attempts:

1. Transition refund status to `permanently_failed`
2. Dispatch admin notification via `NotificationLog` (template: `refund_permanently_failed`)
3. Log structured warning with `refundId`, `bookingId`, `failedReason`, `attempts`

Admin must investigate and either:
- Retry via `POST /api/admin/refunds/{id}/retry` (resets attempt counter)
- Complete manually via `POST /api/admin/refunds/{id}/complete` (bank transfer flow)
- Escalate to PSP support

**Source:** DS-006 (Background Jobs), ADR-012 (Background Jobs).

---

## 8. Ledger Integration

### 8.1 Refund Ledger Entries

On refund completion (status transition to `completed`), two `LedgerEntry` rows are created inside the same `$transaction` that marks the refund as completed:

| Entry Type | Amount | Direction | Purpose |
|------------|--------|-----------|---------|
| `refund_debit` | Negative (reversal) | Reverses original `booking_credit` | Debits operator's platform balance |
| `refund_out` | Positive | Outbound to customer | Tracks the outbound refund payment |

### 8.2 Idempotency Guard

Each `LedgerEntry` uses `sourceEventId = refund.id` to prevent double-writes. The `LedgerEntry` table's unique constraint on `sourceEventId` (or equivalent composite key) ensures that if the transaction retries, no duplicate ledger rows are created.

### 8.3 Transaction Boundary

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Lock refund row
  await tx.$queryRaw`SELECT id FROM "Refund" WHERE id = ${refundId} FOR UPDATE`;

  // 2. Verify legal transition
  const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId } });
  assertLegalTransition(refund.status, 'completed');

  // 3. Update refund status
  await tx.refund.update({
    where: { id: refundId },
    data: { status: 'completed', completedAt: new Date(), pspRefundId },
  });

  // 4. Write ledger entries (append-only, immutable)
  await tx.ledgerEntry.createMany({
    data: [
      {
        type: 'refund_debit',
        amount: -refund.amount,      // negative: reversal
        bookingId: refund.bookingId,
        sourceEventId: refund.id,    // idempotency
        operatorId: booking.operatorId,
      },
      {
        type: 'refund_out',
        amount: refund.amount,
        bookingId: refund.bookingId,
        sourceEventId: refund.id,
        operatorId: booking.operatorId,
      },
    ],
  });
});
```

### 8.4 Ledger Invariant

For any booking that has been fully refunded:

```
SUM(booking_credit for bookingId) + SUM(refund_debit for bookingId) = 0
```

Partial refunds produce a non-zero sum equal to the retained amount (after cancellation fee).

**Source:** DS-001 (LedgerEntry schema), ADR-006 D3 (VND integer arithmetic), Mistake Log Issue 016 (BigInt for currency math).

---

## 9. Cancellation Policy Logic

### 9.1 Art. 29 Consumer Protection Law 2023

Vietnam's Consumer Protection Law 2023, Article 29, grants consumers a **3-business-day cancellation right** for remote contracts (which includes online bus ticket purchases). This right is unconditional within the window -- the consumer does not need to provide a reason.

**Conditions for customer self-cancel (all must be true):**

1. `booking.createdAt + 3 business days > NOW()` (within cancellation window)
2. `trip.departureAt > NOW()` (trip has not departed)
3. `booking.status === 'paid'` (payment was completed)

### 9.2 Cancellation Fee Schedule

Default tiered cancellation fee (deducted from refund amount):

| Window | Fee | Refund Amount |
|--------|-----|---------------|
| Within 24 hours of booking | 0% | 100% of ticket price |
| 24-48 hours after booking | 10% | 90% of ticket price |
| 48-72 hours after booking | 20% | 80% of ticket price |
| After 72 hours | Self-cancel not permitted | N/A |

### 9.3 Refund Amount Computation

```typescript
function computeRefundAmount(
  ticketPrice: bigint,           // VND integer (BigInt domain)
  cancellationFeePct: bigint,    // e.g. BigInt(10) for 10%
): bigint {
  const fee = (ticketPrice * cancellationFeePct) / BigInt(100);
  return ticketPrice - fee;
}
```

All currency arithmetic uses BigInt per Mistake Log Issue 016. The result is converted to `Number` only at the final output boundary (API response serialization).

### 9.4 Operator Override

Operators may define custom cancellation policies via `CancellationPolicy` configuration (per-operator). The operator policy is subject to Art. 29 constraints:

- Operators cannot reduce the 3-business-day window below the statutory minimum
- Operators can extend the window (e.g., 7-day cancellation) or reduce fees (e.g., 0% fee for all cancellations)
- The platform enforces the statutory minimum as a floor

### 9.5 Trip Cancellation Refund

When an operator cancels a trip (T2 trigger):

- **All** `paid` bookings on the trip receive automatic full refunds (0% cancellation fee)
- Refund reason: `trip_cancel`
- No Art. 29 window check (operator-initiated, not customer-initiated)
- Idempotency key: `trip_cancel:<tripId>:<bookingId>` per booking
- Batch creation: one `Refund` row per affected booking, all created inside the same `$transaction` as the trip cancellation

**Source:** Consumer Protection Law 2023 Art. 29, ADR-010 D7, Mistake Log Issue 013 (idempotent cancel with discriminated result).

---

## 10. Refund Processing Flow

### 10.1 Immediate Dispatch (T3, T4)

Oversold race (T3) and overpay difference (T4) refunds are initiated in the `after()` post-commit callback of the payment webhook handler (DS-005 SS3.1 step 8). These refunds:

1. Create `Refund` row with `status = 'refund_requested'`
2. Immediately attempt PSP refund submission (transition to `processing`)
3. On success: transition to `completed`, write ledger entries
4. On failure: transition to `failed`, cron picks up for retry

### 10.2 Deferred Dispatch (T1, T2, T5)

Customer cancel (T1), trip cancel (T2), and admin manual (T5) refunds follow the standard flow:

1. API endpoint creates `Refund` row with `status = 'refund_requested'`
2. Cron picks up within 5 minutes (or immediate dispatch if system load permits)
3. Standard processing/retry cycle

### 10.3 Sequence Diagram

```
Customer                API                  Service              PSP
   |                     |                      |                  |
   |--POST /cancel------>|                      |                  |
   |                     |--cancelBooking()----->|                  |
   |                     |  [inside $transaction]|                  |
   |                     |  - lock booking       |                  |
   |                     |  - verify Art.29      |                  |
   |                     |  - compute fee        |                  |
   |                     |  - update booking     |                  |
   |                     |  - create Refund      |                  |
   |                     |<--{booking,refund}----|                  |
   |<--200 OK------------|                      |                  |
   |                     |                      |                  |
   |              [cron: refundRetry]            |                  |
   |                     |                      |--submitRefund()-->|
   |                     |                      |<--success---------|
   |                     |                      |                  |
   |                     |  [inside $transaction]|                  |
   |                     |  - lock refund        |                  |
   |                     |  - update completed   |                  |
   |                     |  - write ledger       |                  |
```

---

## 11. Observability

### 11.1 Structured Log Events

| Event | Level | Fields | Trigger |
|-------|-------|--------|---------|
| `refund.created` | info | `refundId`, `bookingId`, `amount`, `reason`, `idempotencyKey` | Refund row created |
| `refund.processing` | info | `refundId`, `adapter`, `attempt` | PSP submission initiated |
| `refund.completed` | info | `refundId`, `pspRefundId`, `amount`, `durationMs` | PSP confirms success |
| `refund.failed` | warn | `refundId`, `failReason`, `attempt`, `nextRetryAt` | PSP returns error |
| `refund.permanently_failed` | error | `refundId`, `bookingId`, `totalAttempts` | Max retries exceeded |
| `refund.duplicate` | info | `idempotencyKey` | P2002 caught on insert |

### 11.2 Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `refund_total` | counter | `reason`, `status` |
| `refund_amount_vnd` | histogram | `reason`, `adapter` |
| `refund_processing_duration_ms` | histogram | `adapter` |
| `refund_retry_count` | histogram | `adapter` |

---

## 12. Known Gaps

| Gap | Dependency | Priority |
|-----|------------|----------|
| ZaloPay refund API integration | DS-008 (ZaloPay Adapter) -- refund endpoint TBD | P2 (Month 1-3 post-launch) |
| Cancellation fee configuration UI for operators | Admin/operator dashboard design | P3 |
| Refund-to-wallet (credit balance as alternative to PSP refund) | Wallet feature design (not yet scoped) | P3 |
| Chargeback-triggered refund flow | DS-010 (Chargeback Design) | P2 |
| Refund analytics dashboard (volume, success rate, avg processing time) | Observability infrastructure | P3 |
| Business day calendar for Art. 29 computation (Vietnamese public holidays) | Holiday calendar data source | P2 |
| Multi-booking refund atomicity (trip cancel affecting 100+ bookings) | Batch processing design for large fan-out | P2 |

**Source:** ADR-005 Context, DS-005 Appendix C (Chargeback Risk Analysis).
