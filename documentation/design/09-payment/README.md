> ← [Previous](../08-auth/) | [Index](../README.md) | [Next →](../10-money-ledger/)

## 9. Payment System

### 9.1 Central Collection Model

All customer payments land in **one platform bank account**. The platform then pays out operators' share minus the platform fee.

**Why?**
- The platform only needs to monitor ONE account for incoming payments (not 100+ operator accounts).
- Confirmation is instant — "did money arrive in our account?" vs "did money arrive in some operator's account that we can't read?"
- The platform controls payout timing (settlement delay for dispute buffer).

```
Customer pays ──→ Platform Account ──→ (minus platform fee) ──→ Operator Bank Account
                   ▲                                              (payout)
                   │
            Single account to monitor
```

> **Trade-off**: Central collection means the platform holds ALL customer money before paying operators. This creates regulatory liability (payment license requirements in Vietnam), makes the platform bank account a high-value target, and means an account freeze halts ALL operator payouts. The alternative — direct-to-operator payments — eliminates these risks but makes payment confirmation impossible (we can't see inside 100+ operator bank accounts). At our scale, the operational simplicity of one account to monitor wins.

### 9.2 PSP — Payment Service Provider

**What it is**: A PSP is a company that handles the actual money movement. Instead of integrating with every bank individually, you integrate with one PSP that connects to all of them.

**Vietnam-specific PSPs**:
- **VNPay / PayOS**: VietQR bank transfers, domestic cards
- **MoMo**: Vietnam's largest e-wallet
- **Stripe**: International cards (Visa, Mastercard, PayPal)

**Adapter pattern**: Each PSP has different APIs, webhook formats, and authentication. We write a thin adapter per PSP that translates their specific format into our canonical (standard) event format:

```
MoMo webhook → MoMo adapter → Canonical Event { orderRef, providerTxnId, amount, currency, status }
VNPay webhook → VNPay adapter → Canonical Event { orderRef, providerTxnId, amount, currency, status }
```

The booking logic only knows about canonical events — it never touches PSP-specific code.

### 9.3 Async Payment Flow

**The core problem**: The user clicks "Pay" and is done in 3 seconds. The bank confirms in 30 seconds to 2 minutes. You can't make the user wait.

**Solution**: Asynchronous confirmation via webhook.

```
Timeline:
─────────────────────────────────────────────────────

0s   User clicks "Pay with MoMo"
     → Server creates Payment(status=pending) in DB
     → Server returns MoMo redirect URL to browser
     → User redirected to MoMo app

3s   User authorizes payment in MoMo
     → User redirected back to our "waiting" page
     → Page shows "Payment processing..." with a spinner

30s  MoMo sends webhook POST to /api/payments/momo/webhook
     → Server verifies HMAC signature
     → Adapter translates to canonical event
     → Core: match by orderRef, verify amount, check idempotency
     → Booking status: awaiting_payment → paid
     → Enqueue: send SMS + generate PDF + email

31s  User's "waiting" page polls or receives SSE → shows "Paid! ✓"
```

**Key rules**:
- The server-side webhook is the **single source of truth**. Never trust the client redirect URL (a user could fake `?status=success`).
- The client redirect is just UX — it tells the user "we're checking" and starts polling.

### 9.3.1 Payment Flow — Sequence Diagram

This shows all four actors and the exact sequence of calls:

```
 Browser              Server                    PSP (MoMo)           PostgreSQL
    │                    │                          │                     │
    │ POST /api/bookings/│                          │                     │
    │ initiate           │                          │                     │
    │───────────────────>│                          │                     │
    │                    │ SELECT Hold FOR UPDATE    │                     │
    │                    │─────────────────────────────────────────────────>│
    │                    │<────────────────────────────────────────────────│
    │                    │ INSERT Booking            │                     │
    │                    │ (awaiting_payment)        │                     │
    │                    │─────────────────────────────────────────────────>│
    │                    │<────────────────────────────────────────────────│
    │                    │                          │                     │
    │                    │ createPayment(orderId,   │                     │
    │                    │   amount, ipnUrl)        │                     │
    │                    │────────────────────────>│                     │
    │                    │<───────────────────────│ { payUrl }           │
    │                    │                          │                     │
    │<───────────────────│ { bookingId, payUrl }    │                     │
    │                    │                          │                     │
    │ redirect to payUrl ──────────────────────────>│                     │
    │ (user pays in app)                            │                     │
    │<─────────────────────────────────────────────│ redirect back       │
    │ (shows spinner)    │                          │                     │
    │                    │                          │                     │
    │                    │ POST /api/payments/      │                     │
    │                    │ momo/webhook (IPN)       │                     │
    │                    │<────────────────────────│                     │
    │                    │ verify HMAC signature    │                     │
    │                    │ $transaction {           │                     │
    │                    │   INSERT PaymentEvent    │                     │
    │                    │   UPDATE Booking → paid  │                     │
    │                    │   UPDATE Hold → consumed │                     │
    │                    │   INSERT LedgerEntry ×2  │                     │
    │                    │ }                        │                     │
    │                    │─────────────────────────────────────────────────>│ COMMIT
    │                    │                          │                     │
    │                    │──→ 200 OK ──────────────>│                     │
    │                    │                          │                     │
    │                    │ after(): enqueue SMS +   │                     │
    │                    │ PDF generation jobs      │                     │
    │                    │                          │                     │
    │ (polls or SSE)     │                          │                     │
    │<───────────────────│ "Booking confirmed!"     │                     │
```

The critical insight: everything between `$transaction {` and `COMMIT` is atomic. If any step fails, the entire transaction rolls back — no partial state (booking paid but hold still active, or ledger entries without a booking).

### 9.4 Idempotency

**What it is**: An operation is idempotent if doing it twice produces the same result as doing it once. This is critical because payment providers often send the same webhook multiple times (retries, network glitches).

**How we enforce it**:
- Each payment provider includes a unique `providerTxnId` (transaction ID) in the webhook.
- On first webhook: process normally, store `providerTxnId` in the Payment record.
- On duplicate webhook: check `providerTxnId` exists → already processed → return 200 OK (no-op).

Without idempotency: a retried webhook could credit the operator twice, or send two confirmation SMSes.

### 9.5 Monotonic State Transitions

**What it is**: The payment/booking state machine can only move forward, never backward. `pending → paid` is allowed. `paid → pending` is rejected.

**Why?** Payment webhooks can arrive out of order:
1. PSP sends `status=paid` (webhook A)
2. Network delays webhook A
3. PSP retries with `status=paid` (webhook B)
4. PSP also sends a status query with `status=pending` (webhook C — stale)
5. Webhook C arrives first, then A, then B

Without monotonic enforcement, webhook C would revert a paid booking back to pending. With it, C is silently ignored because `paid → pending` is a backward transition.

### 9.5.1 State Machine Diagrams

**Booking status** (source: `lib/booking/transitions.ts` → `LEGAL_BOOKING_TRANSITIONS`):

```
                            ┌──→ completed           (terminal)
                            │
  awaiting_payment ──→ paid ┼──→ trip_cancelled      (terminal, refund issued)
         │                  │
         │                  ├──→ no_show             (terminal)
         │                  │
         │                  └──→ refunded            (terminal, oversold-race)
         │
         └──→ payment_failed_expired                 (terminal)

  Also terminal: cancelled
```

| Transition | Guard | Side effects |
|-----------|-------|-------------|
| awaiting_payment → paid | Webhook confirms: amount ≥ totalVnd, currency = VND | LedgerEntry ×2 (booking_credit + platform_fee), Hold → consumed, NotificationLog ×2 (SMS + email) |
| awaiting_payment → payment_failed_expired | PSP_WINDOW (20 min) elapsed without webhook | Seats released (hold already expired by sweeper) |
| paid → trip_cancelled | Operator cancels trip | refund_debit + refund_out ledger entries, customer notified |
| paid → no_show | Operator marks after departure | Sets `noShowAt` timestamp |
| paid → refunded | Oversold race: paid but seats gone | Immediate refund-out in same transaction (Issue 100) |

**Hold status** (enum `HoldStatus` — `prisma/schema.prisma`):

```
  active ──┬──→ consumed        (booking created from this hold)
           │
           ├──→ expired         (TTL elapsed — sweeper cron every 1 min)
           │
           └──→ cancelled_trip  (operator cancelled the trip)
```

| Transition | Guard | Key detail |
|-----------|-------|-----------|
| active → consumed | Inside the SAME `$transaction` + `FOR UPDATE` as the Booking INSERT | If transaction aborts, hold stays active — seats not lost |
| active → expired | `hold.expiresAt < NOW()` | Sweeper runs every minute; read-time check as belt-and-suspenders |
| active → cancelled_trip | `cancelTrip()` cascades | All active holds on the cancelled trip are released |

### 9.6 Reconciliation Sweeper

**What it is**: A background job that runs periodically (every 5 minutes) to catch payments that fell through the cracks — webhooks that were lost, network timeouts, etc.

**How it works**:
1. Query all `Payment(status=pending, createdAt < 15 minutes ago)`
2. For each, call the PSP's status-check API
3. If PSP says paid → process as if the webhook arrived
4. If PSP says failed/expired → expire the payment and release the held seats

This is the safety net. The webhook is the fast path; the sweeper catches everything the webhook misses.

### 9.7 VietQR Bank Transfer — Memo Matching

**VietQR** is Vietnam's QR-code-based bank transfer standard. The customer scans a QR code with their banking app, which pre-fills the transfer details including a **memo** (transfer note) containing the booking reference.

**The fragility**: Vietnamese banks sometimes truncate, strip, or garble the memo field. If the memo is lost, we can't match the transfer to the booking by reference.

**Degraded match** (fallback): When memo is missing or garbled, the reconciliation sweeper matches by:
- Correct amount (exact VND match)
- Correct receiving account (our platform account)
- Within a time window (±30 minutes of booking creation)

If exactly one pending booking matches all three criteria → match it. If ambiguous → flag for manual review.
