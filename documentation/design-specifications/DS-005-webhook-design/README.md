# DS-005 -- Webhook Design

## 1. Overview

This document defines the inbound webhook architecture for the BusBooking platform — a multi-tenant Vietnam bus booking marketplace that receives payment confirmation callbacks from Vietnamese PSPs (VNPay, MoMo) and must process them into booking state transitions, ledger entries, notifications, and e-invoices within strict latency and correctness constraints. The webhook layer is the single point where external payment systems meet internal domain logic; its design determines payment reliability, financial integrity, and regulatory compliance.

**Source ADRs.** This document synthesizes decisions from ADR-002 (NFR Targets), ADR-005 (Payment Architecture), ADR-006 (Pricing/Currency), ADR-007 (Observability), ADR-008 (Security Posture), ADR-009 (Concurrency/Seat-Holding), ADR-010 (Booking Lifecycle), ADR-012 (Background Jobs), ADR-013 (Notification Architecture), ADR-014 (E-Invoice Compliance), ADR-015 (Error Contract), ADR-019 (State Machines), ADR-020 (Deployment). Business context from regulatory/payment.md, regulatory/psp-contract-terms.md, regulatory/einvoice-tax.md, regulatory/data-privacy.md, domain-model/event-flows.md, domain-model/state-machines.md, domain-model/invariants-catalog.md.

**Cross-references.** 01-data-model-design for `PaymentEvent`, `LedgerEntry`, `NotificationLog`, `EInvoice` entity schemas. 03-api-contract §2.1 for route namespace table and middleware auth chain. 04-api-versioning §6 for S1-frozen webhook contracts. 06-background-jobs for cron-based catch-up patterns that complement webhook processing.

---

## 2. Webhook Endpoints

### 2.1 Route Table

| Route | PSP | Auth Method | CSRF | Runtime | Purpose |
|-------|-----|-------------|------|---------|---------|
| `/api/payments/momo/webhook` | MoMo | HMAC SHA-256 | Exempt | Origin (Node.js) | MoMo IPN callback — payment result notification |
| `/api/payments/vnpay/webhook` | VNPay | HMAC SHA-512 | Exempt | Origin (Node.js) | VNPay IPN callback — payment result notification |
| `/api/payments/vnpay/return` | VNPay | HMAC SHA-512 | Exempt | Origin (Node.js) | VNPay return URL — browser redirect after payment (dual confirmation path) |
| `/api/payments/bank_transfer/webhook` | Bank transfer (SePay) | Bearer token | Exempt | Origin (Node.js) | SePay webhook — bank transfer confirmation (5-30s latency). See DS-013. |

**Source:** ADR-005 D4, ADR-010 D14.

### 2.2 Edge vs Origin Split

Webhook routes run at **Origin** (Node.js runtime with full Prisma/DB access), not at Edge. The Edge middleware (`proxy.ts`) handles:

- **CSRF exemption**: Webhook routes authenticated via HMAC are exempt from the CSRF double-submit check. The exemption is exact-path-match in a `Set`, not prefix-match (prevents `/api/payments/momo/webhook-bypass` sneak-throughs).
- **Rate limiting**: IP-based rate limiting at Edge still applies to webhook endpoints (via `createRatelimit` on Upstash Redis).

HMAC verification, Zod validation, booking lookup, state transitions, and ledger writes all execute at Origin inside a `prisma.$transaction` callback.

**Source:** ADR-008 D1 (five-layer model, Layer 1 Edge / Layer 2 Origin), Mistake Log Issue 007 (CSRF exemption for HMAC routes).

### 2.3 VNPay Dual Confirmation

VNPay uses two confirmation paths that must both be handled identically and idempotently:

1. **IPN (server-to-server)**: VNPay POSTs to `/api/payments/vnpay/webhook`. This is the authoritative confirmation.
2. **Return URL (browser redirect)**: Customer's browser is redirected to `/api/payments/vnpay/return` with query parameters. This path also processes the payment result (same adapter, same idempotency guard).

Both paths share the same `PaymentEvent @@unique([adapter, providerTxnId])` idempotency constraint. Whichever arrives first triggers the state transition; the second is a no-op returning HTTP 200.

**Source:** ADR-005 D4.

---

## 3. Inbound Webhook Processing Pipeline

Every webhook request follows a strict 8-step processing sequence. Steps 1–2 are pre-transaction guards; steps 3–7 execute inside a single `prisma.$transaction` callback; step 8 is post-commit.

### 3.1 Processing Sequence

```
PSP callback
  │
  ├─ 1. HMAC signature verification (adapter layer)
  │     └─ FAIL → HTTP 400, stop
  │
  ├─ 2. Zod schema validation (request body)
  │     └─ FAIL → HTTP 400, stop
  │
  ├─ 3. Adapter normalization
  │     └─ Raw PSP codes → canonical { status, providerTxnId, amount, currency }
  │
  ├─ 4. Booking lookup by bookingRef
  │     └─ NOT FOUND → HTTP 200 (no enumeration leak), stop
  │
  ├─ 5. PaymentEvent INSERT (idempotent)
  │     └─ P2002 unique violation → HTTP 200 (duplicate, no-op), stop
  │
  ├─ 6. Status-dependent transition
  │     ├─ status = 'paid':
  │     │   ├─ Currency guard: reject non-VND (log warning, no transition)
  │     │   ├─ Amount guard: reject amount < booking.totalVnd (underpay, no transition)
  │     │   ├─ Overpay: log warning, still mark paid, capture overpay for post-commit refund
  │     │   ├─ applyPaidStatusTransition:
  │     │   │   ├─ UPDATE Booking SET status='paid' WHERE status IN legalPredecessors('paid')
  │     │   │   ├─ Hold → 'consumed'
  │     │   │   ├─ SELECT FOR UPDATE on Trip + recount paid seats
  │     │   │   ├─ If paid > capacity → status='refunded' (oversold race)
  │     │   │   ├─ If not oversold → appendBookingPaidLedger (2 LedgerEntry rows)
  │     │   │   └─ Enqueue NotificationLog: customerBookingPaid + operatorNewBooking
  │     │   └─ Create EInvoice row (status='pending')
  │     │
  │     ├─ status = 'failed':
  │     │   └─ UPDATE Booking SET status='payment_failed_expired' WHERE status IN legalPredecessors(...)
  │     │
  │     └─ status = 'pending' | 'unknown':
  │           └─ PaymentEvent recorded only, no booking transition
  │
  ├─ 7. FunnelEvent('booking_paid') with gmvVnd (analytics)
  │
  └─ 8. Post-commit via after():
        ├─ Oversold refund: refundOut keyed 'oversold_race'
        ├─ Overpay refund: refundOut keyed 'overpay_difference'
        └─ Best-effort notification dispatch (cron catch-up if after() fails)
```

**HTTP response**: Always `200` (except `400` for invalid HMAC). No `409`, `422`, or `500` is ever returned to a PSP — non-200 causes retry storms.

**Source:** ADR-005 D4, ADR-009 D7, ADR-010 D7, ADR-013 D4, ADR-019 D7, domain-model/event-flows.md.

---

## 4. Defense Stack

The webhook handler employs a four-layer defense-in-depth stack. Each layer is independent — a bypass in one does not compromise the others.

### 4.1 Layer 1: HMAC Signature Verification

| Property | Value |
|----------|-------|
| MoMo algorithm | HMAC SHA-256 |
| VNPay algorithm | HMAC SHA-512 |
| Failure response | HTTP 400 (the only non-200 response) |
| Secret length | `VNPAY_HASH_SECRET` ≥ 32 chars (enforced via Zod `superRefine` at boot in `env.ts`) |
| Rotation | Deploy new key → in-flight webhooks complete within 5-minute grace window → invalidate old key |
| Sandbox detection | Reject `VNPAY_TMN_CODE === 'VNPAYTEST'` or `MOMO_PARTNER_CODE === 'MOMOBKUN20180529'` when `PAYMENTS_STUB=false` in production |

The HMAC is verified **before** any database operation or body content processing. Spoofed payloads with invalid signatures are rejected without leaking booking state or processing capacity.

**Source:** ADR-005 D4, ADR-008 D7 (rotation), ADR-008 D1 (sandbox sentinels).

### 4.2 Layer 2: Idempotency (PaymentEvent Unique Constraint)

```
PaymentEvent @@unique([adapter, providerTxnId])
```

Duplicate webhook deliveries (PSP retries, network replays) hit a Prisma P2002 unique constraint violation → catch → return HTTP 200 immediately. No state transition, no ledger write, no notification enqueue. This is logged as an informational metric (`P2002 duplicate count per PSP`), not an error.

The `LedgerEntry.sourceEventId` unique constraint provides a second idempotency fence at the ledger layer — prevents double-crediting even if the PaymentEvent guard were somehow bypassed.

**Source:** ADR-005 D4, ADR-005 D5.

### 4.3 Layer 3: Amount Guard

| Condition | Action | Rationale |
|-----------|--------|-----------|
| `amount >= booking.totalVnd` AND `currency = 'VND'` | Mark paid | Normal flow |
| `amount < booking.totalVnd` | No transition; log warning | Underpay — booking stays in `awaiting_payment`; customer must retry or contact support |
| `amount > booking.totalVnd` | Mark paid; enqueue post-commit overpay refund | Defense-in-depth — operator receives exactly `booking.totalVnd`; excess returned to customer |
| `currency != 'VND'` | No transition; log warning | Currency mismatch — reject without state change |

The `booking.totalVnd` value is server-derived from `Trip.price * Hold.ticketCount` at booking creation (Invariant I7: no client-originated price). The amount guard is a defense-in-depth check against PSP-side discrepancies, not primary price integrity enforcement.

**Source:** ADR-005 D4, ADR-006 D3, ADR-010 D6 (I7 invariant).

### 4.4 Layer 4: Oversold Race Guard

After marking a booking `paid`, the handler performs a capacity recheck within the same transaction:

1. `SELECT FOR UPDATE` on the Trip row (serializes concurrent webhook processing for the same trip).
2. Recount paid bookings for the trip.
3. If `paid_count > trip.capacity` → immediately set this booking to `refunded` + enqueue post-commit `refundOut`.

This is Layer 2 of the three-layer capacity guard (Layer 1 = hold creation check; Layer 3 = PSP window expiry at 20 minutes). The `SELECT FOR UPDATE` lock ensures that two concurrent `paid` webhooks for the same near-capacity trip cannot both succeed — the second one serializes behind the first and triggers the oversold refund if capacity is exceeded.

**Source:** ADR-009 D7 (three-layer guard), ADR-019 D3 (`SELECT FOR UPDATE` in `$transaction`).

---

## 5. PSP Adapter Layer

### 5.1 Anti-Corruption Layer

Each PSP has a dedicated adapter that normalizes raw provider-specific response codes into a canonical interface:

```typescript
type CanonicalPaymentStatus = 'paid' | 'failed' | 'pending' | 'unknown'

interface NormalizedWebhookResult {
  status: CanonicalPaymentStatus
  providerTxnId: string
  amount: number        // VND integer
  currency: string      // must be 'VND'
  rawResultCode: string // original PSP code, for logging only
}
```

PSP-specific codes (`resultCode`, `vnp_ResponseCode`) never cross into domain logic. The adapter is the sole translation boundary — PSP version upgrades are absorbed here without domain API changes.

**Source:** ADR-005 D2, ADR-010 D14.

### 5.2 MoMo IPN

| Property | Value |
|----------|-------|
| Endpoint | `developers.momo.vn/v3` (AIO) |
| HMAC | SHA-256 |
| Settlement | T+1 to T+2 |
| Sandbox | Available at signup; no ERC required |
| Refund API | Yes — AIO refund endpoint (programmatic) |
| Retry window | Up to 15 minutes (1, 3, 5, 10, 15 min schedule) |
| E-wallet monthly cap | VND 100M (~USD 4,000) |
| Biometric trigger | Single transaction ≥ VND 10M |

**`FAILURE_RESULT_CODES`** — pinned to the exact set from issue acceptance criteria:

```
{1001, 1002, 1003, 1004, 1005, 4100}
```

Explicitly **excluded** codes:
- `9001` — "transaction in process" in some MoMo doc revisions; collides with `9000` (pending) pattern; would mis-transition in-flight payments to `payment_failed_expired`.
- `1006`, `1007`, `1026` — from general MoMo documentation but outside the spec AC.

**Rule:** Enum/code-list constants that drive state-machine transitions must be sourced from issue acceptance criteria verbatim, not augmented from upstream vendor docs. Vendor-doc supersets belong in a follow-up issue with explicit AC additions.

**Source:** ADR-005 D4, Mistake Log Issue 004.

### 5.3 VNPay

| Property | Value |
|----------|-------|
| HMAC | SHA-512 |
| API version | `vnp_Version=2.1.0` |
| Settlement | T+1 standard; same-day premium tier available |
| Refund API | Yes — programmatic reversal |
| Dual confirmation | Return URL + IPN (both must be idempotent) |
| Chargeback window | 45–90 days (card-network dependent) |
| Chargeback fee | VND 200,000–500,000 per dispute |
| Dispute resolution | NAPAS timeline, up to 45 days |
| Production approval | 5–15 business day testing gate |
| Secret requirement | `VNPAY_HASH_SECRET` ≥ 32 characters |

**Source:** ADR-005 D4, regulatory/psp-contract-terms.md.

### 5.4 Bank Transfer via SePay Webhook

> **Updated 2026-06-20**: Previously stated "no programmatic webhook." SePay (sepay.vn) provides push-based webhook for bank transfer confirmation (5-30s latency). See DS-013 for full design.

Bank transfer uses SePay — a bank account monitoring service that sends webhooks when transfers arrive. The adapter implements `PaymentGateway` and routes through the same `processPaymentWebhook` pipeline as MoMo/VNPay.

| Concern | Approach |
|---------|----------|
| Confirmation | SePay webhook (push-based, 5-30s latency) — same architecture as MoMo/VNPay |
| Auth | Bearer token (`Authorization: Bearer <SEPAY_API_KEY>`) — verified in route handler before `processPaymentWebhook` |
| Adapter name | `'bank_transfer'` (PaymentEvent.adapter value) |
| BookingRef extraction | Case-insensitive regex on SePay `content` field |
| Refund | Manual reverse transfer only — no programmatic refund API |
| Chargeback | None — bank transfer model, no card-network dispute process |
| Risk | ~5% of transfers: customer mistypes/omits memo → webhook fires but no bookingRef extracted → admin manual reconciliation |

**Bank:** Agribank (BIN 970405, account 3516205005863). Configurable via env.

**Source:** DS-013, ADR-005 D7, regulatory/psp-contract-terms.md.

### 5.5 Secret Rotation Runbook

1. Generate new HMAC key.
2. Deploy new key to production (both old and new accepted during transition).
3. Wait 5 minutes — in-flight webhooks signed with the old key complete.
4. Remove old key from accepted set.
5. Update PSP dashboard with new key (5–15 business day re-approval for VNPay/MoMo production).

**Source:** ADR-008 D7.

---

## 6. State Machine Transitions

### 6.1 Booking Transitions Triggered by Webhooks

| Webhook Status | Booking Transition | Guard | Side Effects |
|----------------|-------------------|-------|-------------|
| `paid` | `awaiting_payment` → `paid` | `amount >= totalVnd`, `currency = 'VND'`, `status IN legalPredecessors('paid')` | Hold → `consumed`; 2 LedgerEntry rows; 2 NotificationLog rows; EInvoice row |
| `paid` (oversold) | `awaiting_payment` → `paid` → `refunded` (same tx) | `SELECT FOR UPDATE` on Trip; `paid_count > capacity` | Post-commit `refundOut` keyed `oversold_race` |
| `failed` | `awaiting_payment` → `payment_failed_expired` | `status IN legalPredecessors('payment_failed_expired')` | None (booking terminal) |
| `pending` / `unknown` | No transition | — | PaymentEvent INSERT only |

### 6.2 LEGAL_BOOKING_TRANSITIONS (Excerpt)

```typescript
const LEGAL_BOOKING_TRANSITIONS = {
  awaiting_payment: ['paid', 'payment_failed_expired', 'cancelled', 'trip_cancelled'],
  paid: ['completed', 'cancelled', 'trip_cancelled', 'refunded', 'no_show'],
  // terminal: completed, cancelled, trip_cancelled, no_show, payment_failed_expired, refunded
}
```

The `legalPredecessors(target)` function returns the array of statuses that can legally transition TO the target. Used in every webhook-driven UPDATE's WHERE clause: `WHERE status IN legalPredecessors(...)`. This ensures:

- **Idempotent replays**: A second `paid` webhook for an already-paid booking matches zero rows — no-op.
- **No state regression**: A `paid` webhook arriving after a booking has advanced to `completed` or been `cancelled` is safely ignored.
- **Concurrent safety**: Two `paid` webhooks for the same booking serialize via the WHERE guard — the second sees `status = 'paid'` which is not in `legalPredecessors('paid')`.

**Source:** ADR-019 D2, ADR-010 D7.

### 6.3 Side Effects Table (paid Transition)

All side effects execute atomically within the same `$transaction`:

| Side Effect | Model | Details |
|-------------|-------|---------|
| Hold consumed | `Hold` | `status → 'consumed'` |
| Booking credit ledger | `LedgerEntry` | `entryType = 'booking_credit'`, `+gross VND`, keyed by `sourceEventId` |
| Platform fee ledger | `LedgerEntry` | `entryType = 'platform_fee'`, `-fee VND`, keyed by `sourceEventId` |
| Customer notification | `NotificationLog` | `template = 'customerBookingPaid'`, `status = 'pending'` |
| Operator notification | `NotificationLog` | `template = 'operatorNewBooking'`, `status = 'pending'` |
| E-invoice creation | `EInvoice` | `status = 'pending'` (submitted to MISA by 5-min cron) |

**Source:** ADR-019 D7, ADR-010 D7, ADR-010 D13.

---

## 7. Ledger Writes

### 7.1 Two-Entry Pattern

Every `paid` webhook creates exactly two `LedgerEntry` rows atomically:

| Entry | `entryType` | Sign | Amount | Purpose |
|-------|-------------|------|--------|---------|
| Booking credit | `booking_credit` | Positive (+) | `booking.totalVnd` (gross ticket amount) | Credits operator's balance |
| Platform fee | `platform_fee` | Negative (−) | `calcPlatformFeeMinor(gross, platformFeePct)` | Debits operator for platform commission |

### 7.2 BigInt Arithmetic

All currency math multiplying an integer minor-unit value (VND) by a fractional rate is performed in the BigInt domain:

- Platform fee rate stored as `ratePpm` (parts-per-million integer): e.g., `60000` = 6%.
- Computation: `BigInt(Math.round(pct * 1e10)) / BigInt(1e10)` → all arithmetic in BigInt → exact tie detection via `remainder * BigInt(2) === denominator` → final `Number(result)`.
- **ES2017 constraint**: `BigInt(n)` constructor calls only — `1n` / `2n` / `0n` literal suffixes are parser errors under `--target es2017`.
- **Greppable bug**: Any `Math.round(<int> * <fractional>)` or `Math.floor(<minor-unit> * <rate>)` in money-handling modules is a representation drift bug.

Default platform fee: 6% (configurable per operator via admin; floor 5%, ceiling 20%; code-enforced `MAX_FEE_OVERRIDE_PPM = 200,000`).

**Source:** ADR-005 D6, ADR-006 D5, Mistake Log Issue 016.

### 7.3 Idempotency and Immutability

| Guard | Mechanism |
|-------|-----------|
| Idempotency | `LedgerEntry.sourceEventId` unique constraint — prevents double-crediting from webhook replays |
| Immutability | PostgreSQL `BEFORE UPDATE/DELETE` trigger (`ledger_entry_immutable`) — no UPDATE or DELETE permitted |
| Retention | T3 Financial: 10 years (Accounting Law) |

### 7.4 Refund Keying

Post-commit refunds (via `refundOut()`) are keyed for idempotency:

| Scenario | Key Pattern | Trigger |
|----------|-------------|---------|
| Trip cancellation | `cancel:<tripId>:<bookingId>` | Operator/admin cancels trip → cascade refund per paid booking |
| Oversold race | `oversold_race:<bookingId>` | Webhook capacity recheck detects paid > capacity |
| Overpay difference | `overpay_difference:<bookingId>` | Webhook amount > booking.totalVnd |

Refund creates two LedgerEntry rows: `refund_debit` (reverses `booking_credit`) + `refund_out` (records outbound refund to customer). Both append-only.

**Source:** ADR-005 D5, ADR-005 D7.

---

## 8. Notification Enqueue

> **Full notification dispatch architecture**: See DS-006 (Background Jobs) §5 for the complete dispatch model, channel hierarchy, retry strategy, and `after()` acceleration pattern. This section covers only the webhook-specific enqueue behavior.

### 8.1 Outbox Pattern with `after()` Acceleration

Webhook handlers **enqueue** `NotificationLog` rows with `status = 'pending'`, then use `after()` to attempt best-effort dispatch post-commit. The `notificationDispatch` cron (every 1 minute) catches any rows that `after()` missed.

**Critical decoupling invariant:** Notification failure must NEVER affect booking state. The booking is `paid` because the payment webhook confirmed it. If SMS fails, the booking is still paid.

**Rationale:** Synchronous notification sending inside the webhook handler risks webhook timeout, causing PSP retry storms that compound the problem. The `after()` hook fires after the HTTP 200 response is already sent, so PSP retry behavior is unaffected.

**Source:** ADR-013 D4 (time-critical exemption), ADR-012 D2/D6, DS-006 §5.

### 8.2 I9 Invariant: Phone Segregation

- `NotificationLog.recipient` column carries the phone number for delivery.
- The `payload` JSON field **must never contain the phone number** — prevents double-exposure if payload is logged or exported.
- Enforcement: every `NotificationLog` INSERT in webhook-triggered code places phone only in `recipient`.

**Source:** ADR-013 D7.

### 8.4 Channel Hierarchy

ZNS (primary, 200–500 VND/msg) → SMS fallback (after 60s ZNS failure) → email (supplementary).

**Implementation status:** ZNS not yet integrated. eSMS SMS functions as primary channel.

### 8.5 Webhook-Triggered Notifications

| Template | Channel | Trigger | Content |
|----------|---------|---------|---------|
| `customerBookingPaid` | ZNS/SMS | `awaiting_payment → paid` | Booking confirmation with booking ref, route, departure time |
| `operatorNewBooking` | ZNS/SMS | `awaiting_payment → paid` | New booking notification with passenger count, revenue |

---

## 9. E-Invoice Trigger

### 9.1 Creation at Paid Status

When a booking transitions to `paid` via webhook, an `EInvoice` row is created with `status = 'pending'`. Submission to MISA meInvoice is asynchronous — handled by the `einvoiceSubmission` cron (every 5 minutes).

### 9.2 EInvoice State Machine

| From | To | Trigger |
|------|-----|---------|
| *(creation)* | `pending` | Booking reaches `paid` status |
| `pending` | `issued` | Submitted to MISA meInvoice; sets `invoiceNumber`, `issuedAt` |
| `issued` | `sent` | Delivery confirmed |
| `pending` | `failed` | Submission failure (queued for retry) |
| `issued` / `sent` | `cancelled` | Voided — a NEW EInvoice row is created for the corrected invoice (immutability) |

### 9.3 Regulatory Requirements

| Requirement | Source | Status |
|-------------|--------|--------|
| E-invoice no later than payment confirmation | Circular 78/2021 | Compliant (triggered by webhook, same-day issuance) |
| Issuance within next business day | Decree 123/2020 | Compliant (MISA retry on failure) |
| 10-year archival in original electronic form | Decree 123/2020 | MISA handles archival |
| Transport-specific fields: vehicle plate, route (departure + destination cities), operator MST | Decree 70/2025 | **NOT YET IMPLEMENTED** — compliance gap before go-live |
| Digital signature from GDT-approved provider | Decree 70/2025 | MISA handles signing |

### 9.4 Invoice Types

| Type | Issuer → Recipient | Trigger | Frequency |
|------|-------------------|---------|-----------|
| Ticket invoice | Operator → Customer | Payment webhook (per booking) | Per transaction |
| Commission invoice (B2B) | Platform → Operator | Monthly settlement | Monthly |

The ticket invoice shows the operator as seller (with operator's MST/tax code), not the platform. Platform can issue on operator's behalf under Decree 123 Art. 17 (expanded by Decree 70/2025), requiring formal written agreement + GDT notification.

**Source:** ADR-010 D13, ADR-014 D1, regulatory/einvoice-tax.md.

---

## 10. Timing Constants

| Constant | Value | Rationale | Source |
|----------|-------|-----------|--------|
| Hold TTL | 10 minutes | Seat reservation window before payment initiation | ADR-009 D4 |
| `PSP_WINDOW_MINUTES` | 20 minutes | MoMo 15-min retry window + 5-min buffer for network jitter | ADR-009 D5 |
| MoMo retry schedule | 1, 3, 5, 10, 15 min | PSP-side retry after initial callback | ADR-009 D5 |
| `SETTLEMENT_DELAY_DAYS` | 1 day | T+1 settlement — payout eligible at `completedAt + 1 day` | ADR-005 D3 |
| Access JWT TTL | 15 minutes | Token expiry for operator/admin sessions | ADR-003 D2 |
| E-wallet biometric trigger | VND 10M per transaction | May cause webhook delay for large bookings | ADR-005 Context |
| E-wallet monthly cap | VND 100M per user | Group bookings may fail mid-checkout invisibly | ADR-005 Context |
| E-invoice submission cron | Every 5 minutes | Async MISA submission for `pending` invoices | ADR-012 Job Catalog |
| Notification dispatch cron | Every 1 minute | Catch-up for `pending` notifications `after()` missed | ADR-012 Job Catalog |
| Payment recon sweeper | Every 30 minutes | Backup reconciliation for unmatched bank transfers (optional, post-launch — SePay webhook is primary) | ADR-012 Job Catalog |

### 10.1 PSP Window Rationale

The 20-minute `PSP_WINDOW_MINUTES` was chosen over 15 minutes because approximately 1–3% of MoMo's final retries land at +15 minutes and 1–5 seconds. A 15-minute window creates a non-zero oversell rate from a timing race: the seat reservation expires at exactly 15:00, but the final retry webhook arrives at 15:01–15:05 — after the seat has been released to another customer.

After `PSP_WINDOW_MINUTES` elapses without a payment webhook, bookings in `awaiting_payment` are excluded from capacity calculations without an explicit state transition. A delayed failure webhook is still handled safely by the oversold guard.

**Source:** ADR-009 D5, ADR-002 D4.

---

## 11. HTTP Response Contract

### 11.1 Response Rules

| Condition | HTTP Status | Body | Rationale |
|-----------|-------------|------|-----------|
| Invalid HMAC signature | 400 | Error envelope | Reject forged requests; PSP will not retry 400 |
| Invalid Zod schema | 400 | Error envelope | Malformed request body |
| All other cases | 200 | `{ received: true }` | PSPs retry on non-200; retry storms compound the problem |
| Duplicate webhook (P2002) | 200 | `{ received: true }` | Idempotent no-op; informational metric |
| Amount mismatch (underpay) | 200 | `{ received: true }` | PaymentEvent recorded; no booking transition |
| Booking not found | 200 | `{ received: true }` | No enumeration leak; PaymentEvent recorded |

**S1-frozen contract:** The webhook response rule (always HTTP 200 except 400 for invalid HMAC) is classified as S1-stable in 04-api-versioning §6.1. Changing this requires PSP re-approval (5–15 business days).

**Source:** ADR-005 D4, ADR-013 D4, ADR-015 D1.

### 11.2 Error Envelope Format

When HTTP 400 is returned:

```json
{
  "error": {
    "code": "invalid_hmac_signature",
    "message": "HMAC verification failed"
  }
}
```

- `code` — machine-readable snake_case string (S1-stable).
- `message` — human-readable English (S3-unstable, may change without notice).

**Source:** ADR-015 D1.

---

## 12. Security Controls

### 12.1 Controls Summary

| Control | Layer | Implementation |
|---------|-------|---------------|
| HMAC signature verification | Application (Origin) | Per-PSP adapter; HTTP 400 on failure |
| CSRF exemption | Edge (`proxy.ts`) | Exact-match `Set` of webhook paths; HMAC serves as auth instead |
| Zod `.strip()` validation | Application (Origin) | Removes unrecognized keys — prevents mass assignment of `operatorId`, `price`, `status` |
| SQL injection prevention | ORM (Prisma) | All queries parameterized; `$queryRaw` uses `Prisma.sql` tagged template |
| Secret length enforcement | Boot-time | `VNPAY_HASH_SECRET` ≥ 32 chars via Zod `superRefine` in `env.ts` |
| Sandbox sentinel detection | Boot-time | Rejects `VNPAY_TMN_CODE === 'VNPAYTEST'` or `MOMO_PARTNER_CODE === 'MOMOBKUN20180529'` when `PAYMENTS_STUB=false` |
| Rate limiting | Edge | IP-based via `createRatelimit` (Upstash Redis) |
| IP allowlist | *(none)* | Not documented — gap |

### 12.2 Known Security Gaps

| Gap | Risk | Mitigation |
|-----|------|------------|
| No IP allowlist for PSP webhooks | Medium — HMAC is the primary auth; IP allowlist would be defense-in-depth | HMAC verification is sufficient; IP allowlist is a future hardening option |
| Rate limiter fails open on Redis downtime | Medium — if Upstash is unreachable, all requests pass unthrottled | No circuit-breaker or in-memory fallback documented (Risk #13 in risk-matrix.md) |
| HTTP security headers not configured | Low for webhooks (server-to-server) | No CSP, HSTS, X-Frame-Options on any response; relevant for browser-facing return URL |
| Secret rotation runbook not documented | Medium — operational risk during key compromise | Process described in §5.5; formal runbook file not created |

**Source:** ADR-008 D1, ADR-008 D7, ADR-008 D11.

---

## 13. Observability

### 13.1 Five Payment Monitoring Vectors

| # | Metric | Purpose | Alert Threshold |
|---|--------|---------|----------------|
| 1 | Webhook volume per PSP per 15-min window | Anomaly detection baseline | P2: >50% drop from rolling average |
| 2 | HMAC verification failure count | Forgery detection | Every failure is a potential forgery attempt |
| 3 | P2002 duplicate count per PSP | Replay volume (idempotency dedup firing) | Informational — not an error |
| 4 | Amount mismatch count | Underpay rejected + overpay logged | Spike = PSP-side configuration issue |
| 5 | Unmatched bank transfer payments | SePay webhook received but no bookingRef extracted from memo | ~5% edge case; admin manual reconciliation |

**Source:** ADR-007 D5.

### 13.2 Alert Tiers

| Tier | Condition | Notification | Response SLA |
|------|-----------|-------------|-------------|
| **P1 Critical** | All webhooks failing >5 min | Immediate push + phone call | 15 min ack, 1 hr resolution |
| **P2 High** | One PSP webhook volume drops >50% from baseline | Push notification | 30 min ack, 4 hr resolution |
| **P2 High** | eSMS delivery failures >10% | Push notification | 30 min ack, 4 hr resolution |

During the **2-week Tet window**: P2 response SLA tightens to P1 levels (15 min ack). Threshold baselines switch to Tet-calibrated values (10x multiplier on normal baselines before first Tet data).

**Source:** ADR-007 D6, ADR-002 I.

### 13.3 PII Redaction

Fields redacted at log serialization before data leaves the application:

`phone`, `email`, `otpProof`, `customerName`, `buyerName`, `buyerPhone`, `buyerEmail`, `codeHash`, `password`, `passwordHash`, `tempPasswordPlain`, `accountNumber`, `holderName`, `taxCode`, `cccd`.

**Rule:** Any field added to a PII-bearing model must be added to the redaction list in the same commit.

**Source:** ADR-007 D2.

### 13.4 Audit Model

`PaymentEvent` is a domain-specific audit model with T3 Financial retention (5 years per Accounting Law). It has domain-specific schema and indexes, queryable via SQL against Vietnam-hosted PostgreSQL. Request-scoped `correlationId` enables grep-based trace reconstruction across webhook processing steps.

**Source:** ADR-007 D3, ADR-007 D7.

### 13.5 Implementation Status

| Component | Status |
|-----------|--------|
| Structured JSON logging (`lib/core/logger.ts`) | Deployed |
| PII redaction at serialization | Deployed |
| `PaymentEvent` domain audit model | Deployed |
| Sentry error capture with `beforeSend` PII scrub | **NOT DEPLOYED** |
| BetterStack uptime monitoring (2-min detection) | **NOT DEPLOYED** |
| Webhook volume anomaly alerting | **NOT DEPLOYED** |
| Payment anomaly detection ≤5 min target | **NOT DEPLOYED** |

**Source:** ADR-007 D1, ADR-008 D11.

---

## 14. Regulatory Constraints

### 14.1 Data Localization

All webhook-processed data (payment events, booking state, ledger entries) is stored in Vietnam-hosted PostgreSQL. Personal information of service users, payment information, and IP addresses must be stored in Vietnam per Decree 53/2022 and Law 116/2025 (effective 1 July 2026).

**Risk:** If webhook logs flow through Vercel (Singapore region) or overseas APM tools, that constitutes a cross-border transfer of PII under PDPL 2025. A CDTIA (Cross-border Data Transfer Impact Assessment) must be filed with A05 (Ministry of Public Security) within 60 days of first processing. Penalty for unauthorized cross-border transfers: up to 5% of prior-year Vietnam annual revenue.

**Source:** regulatory/data-privacy.md.

### 14.2 Breach Notification

| Scenario | Deadline | Authority |
|----------|----------|-----------|
| General data breach | 72 hours | A05 (Ministry of Public Security) |
| Cybersecurity attack affecting consumer info | 24 hours | A05 |
| Financial sector breach | As above + individual notification | Affected data subjects |

`NotificationLog.recipient` column enables `SELECT DISTINCT recipient WHERE ...` for breach-scope queries.

**Source:** regulatory/data-privacy.md.

### 14.3 Tax Withholding (E-Commerce Law 2025)

Effective **July 2026**: For individual/household operators, the platform must withhold VAT ~3% + PIT ~1.5% from payouts. This is triggered downstream from webhook processing — at payout settlement time, not at webhook receipt. The webhook-triggered `booking_credit` ledger entry provides the basis for computing withholding at payout.

**Source:** regulatory/payment.md, regulatory/einvoice-tax.md.

### 14.4 FCT Withholding Remittance

Foreign Contractor Tax (for non-Vietnam-resident platform entities): remittance deadline is 10 days per payment event. Relevant if the platform entity is foreign-registered.

**Source:** ADR-014 D5.

### 14.5 Chargeback Exposure

| PSP | Chargeback Window | Current Handling |
|-----|-------------------|-----------------|
| VNPay (card networks) | 45–90 days | **No operational workflow** — no `paid → chargeback` state, no admin queue, no reserve |
| MoMo | MoMo-mediated (internal SLA) | No chargeback state |
| Bank transfer (VietQR/SePay) | None (bank transfer, no dispute process) | N/A |

T+1 settlement means operator funds can be disbursed before the 45–90 day chargeback window closes. No chargeback reserve (holdback percentage per settlement) is implemented.

**Required action before launch:** Design chargeback workflow OR implement holdback reserve OR extend settlement delay past chargeback window.

**Source:** regulatory/psp-contract-terms.md.

### 14.6 Fund Flow Regulatory Risk

Current implementation uses a central collection model (single platform merchant account). This is the highest-risk ("Hybrid/pooling") model and could be classified as unlicensed `thu ho chi ho` (collection/payment support) by the State Bank of Vietnam — requiring an Intermediary Payment Service (IPS) license with VND 50 billion registered capital.

**Target architecture:** VNPay settles directly to each operator's bank account (split-settlement). This removes the platform from the fund flow and eliminates the IPS license requirement.

**Source:** regulatory/payment.md.

---

## 15. NFR Targets

| Metric | Target | Alert Threshold | Rationale | Source |
|--------|--------|----------------|-----------|--------|
| Webhook processing latency | p95 ≤ 500ms | ≤ 1000ms | 500ms covers `SELECT FOR UPDATE` + status transition + ledger + capacity recount. Alert at 1000ms = approaching PSP retry-timeout threshold. Going below 200ms rejected — would require removing capacity-guard recount from webhook path. | ADR-002 G |
| `PSP_WINDOW_MINUTES` | 20 min | — | MoMo 15-min final retry + 5-min buffer | ADR-009 D5 |
| Payment anomaly detection | ≤ 5 min | — | Webhook volume drop >50% from 15-min rolling average | ADR-002 I |
| Platform availability | 99.5% monthly | — | Escalates to 99.9% during 2-week Tet window | ADR-002 D2 |
| Throughput | 2,000 concurrent booking attempts | — | Tet-peak estimate including PSP retry storm multiplier (2x) | ADR-002 D3 |
| Payment failure rate | < 3% | > 3% | Investor KPI — above 3% indicates gateway configuration issue, UX friction, or PSP degradation | ADR-002 G |
| Payout failure rate | — | > 5% per operator | Operational alert | ADR-007 D5 |
| External probe (uptime) | 2-min detection | 2 consecutive failures (120s) | BetterStack external probe (NOT YET DEPLOYED) | ADR-002 I |

---

## 16. Known Gaps and Implementation Status

| Gap | Category | Risk | Required Before |
|-----|----------|------|----------------|
| `paymentReconSweeper` backup cron not built | Feature | LOW — SePay webhook is primary; cron is optional backup for orphaned transfers | Post-launch |
| Chargeback workflow absent | Feature | HIGH — no `paid → chargeback` state, no reserve, T+1 settlement exposure | Go-live |
| Transport e-invoice fields missing | Compliance | HIGH — Decree 70/2025 non-compliance (plate, route, operator MST) | Go-live |
| Sentry not installed | Observability | MEDIUM — no unhandled exception capture with PII scrub | Go-live |
| BetterStack not deployed | Observability | MEDIUM — no external uptime monitoring, 2-min detection target unmet | Go-live |
| Webhook volume anomaly alerting not built | Observability | MEDIUM — payment anomaly ≤5 min detection target unmet | Go-live |
| IP allowlist for PSP sources | Security | LOW — HMAC is primary auth; IP is defense-in-depth | Post-launch hardening |
| HTTP security headers absent | Security | LOW for server-to-server webhooks; MEDIUM for browser return URL | Go-live |
| Rate limiter fail-open on Redis downtime | Security | MEDIUM — no fallback if Upstash unreachable | Post-launch hardening |
| Payout `processing` stranding | Operations | MEDIUM — crashed cron leaves payout in `processing` indefinitely | Go-live |
| Secret rotation runbook not formalized | Operations | MEDIUM — ad-hoc process during key compromise | Go-live |
| CDTIA filing for overseas log processing | Compliance | HIGH — 5% revenue penalty for unauthorized cross-border transfer | Go-live (if using overseas hosting) |
| Fund flow restructure (split-settlement) | Compliance | CRITICAL — current pooling model risks IPS license requirement | Pre-scale (before significant transaction volume) |
| ZNS channel integration | Feature | LOW — SMS fallback functional | Post-launch |
| OTP dispatch model conflict (3 conflicting descriptions) | Architecture | LOW — functional but inconsistent documentation | Post-launch cleanup |

---

## 17. Decision Log

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| W1 | HMAC + idempotency + amount guard (full defense stack) over HMAC-only | 2026-06-19 | HMAC authenticates origin; idempotency prevents replay; amount guard catches PSP-side discrepancies. Three independent layers — bypass in one does not compromise others |
| W2 | Always HTTP 200 to PSP (except 400 for invalid HMAC) | 2026-06-19 | Non-200 causes PSP retry storms; VNPay/MoMo both retry on non-200. S1-frozen contract |
| W3 | `PaymentEvent @@unique([adapter, providerTxnId])` for idempotency | 2026-06-19 | P2002 catch → 200 is simpler and more reliable than SELECT-before-INSERT race window |
| W4 | `PSP_WINDOW_MINUTES = 20` (not 15) | 2026-06-19 | MoMo's final retry at +15 min; 1–3% of retries land at 15:01–15:05; 15-min window creates non-zero oversell rate |
| W5 | `FAILURE_RESULT_CODES` pinned to AC verbatim, never augmented from vendor docs | 2026-06-19 | Vendor-doc superset codes (e.g., `9001`) collide with pending patterns; mis-transition to terminal failure state |
| W6 | Webhook handlers enqueue notifications, never dispatch in-process | 2026-06-19 | Synchronous dispatch risks webhook timeout → PSP retry storm. Notification failure must never affect booking state |
| W7 | E-invoice creation async (cron-based MISA submission) | 2026-06-19 | Decree 123/2020 allows next-business-day issuance. Blocking webhook on MISA latency unacceptable |
| W8 | Oversold race detection inside webhook transaction (Layer 2 capacity guard) | 2026-06-19 | `SELECT FOR UPDATE` on Trip serializes concurrent webhooks; recount catches capacity violations that slipped through hold-time checks |
| W9 | BigInt arithmetic for all webhook-triggered ledger math | 2026-06-19 | Number multiplication of VND integers by fractional rates introduces representation drift; half-even rounding breaks on wrong side of tie |
| W10 | No IP allowlist at Stage 0 | 2026-06-19 | HMAC is the primary webhook auth; IP allowlist is defense-in-depth for post-launch hardening. PSP source IPs may change without notice |
| W11 | ~~VietQR reconciliation via cron sweeper (no webhook)~~ → Bank transfer uses SePay webhook (push-based) | 2026-06-20 | SePay provides push-based webhook for Agribank transfers; cron sweeper demoted to optional backup. See DS-013 |
| W12 | Booking not found → HTTP 200 (no enumeration leak) | 2026-06-19 | Returning 404 would confirm/deny booking existence to an attacker who controls webhook delivery |

---

## Appendix A: Webhook Processing Sequence (Text Diagram)

```
                         ┌──────────────┐
                         │  PSP Server  │
                         │ (MoMo/VNPay) │
                         └──────┬───────┘
                                │ POST /api/payments/{psp}/webhook
                                ▼
                    ┌───────────────────────┐
                    │   Edge Middleware      │
                    │   (proxy.ts)           │
                    │  • CSRF: EXEMPT        │
                    │  • Rate limit: APPLY   │
                    └───────────┬───────────┘
                                │
                                ▼
              ┌─────────────────────────────────┐
              │  Route Handler (Origin/Node.js)  │
              │                                  │
              │  1. HMAC verify ──── FAIL → 400  │
              │  2. Zod parse ────── FAIL → 400  │
              │                                  │
              │  ┌──── $transaction ────────────┐ │
              │  │ 3. Adapter normalize         │ │
              │  │ 4. Booking lookup            │ │
              │  │    └─ NOT FOUND → 200, stop  │ │
              │  │ 5. PaymentEvent INSERT       │ │
              │  │    └─ P2002 → 200, stop      │ │
              │  │ 6. Status branch:            │ │
              │  │    ├─ paid:                  │ │
              │  │    │  ├─ Currency guard      │ │
              │  │    │  ├─ Amount guard        │ │
              │  │    │  ├─ Booking → paid      │ │
              │  │    │  ├─ Hold → consumed     │ │
              │  │    │  ├─ Trip FOR UPDATE     │ │
              │  │    │  │  └─ oversold? →      │ │
              │  │    │  │    refunded           │ │
              │  │    │  ├─ 2× LedgerEntry      │ │
              │  │    │  ├─ 2× NotificationLog  │ │
              │  │    │  └─ EInvoice (pending)  │ │
              │  │    ├─ failed:               │ │
              │  │    │  └─ Booking →           │ │
              │  │    │    payment_failed_exp   │ │
              │  │    └─ pending/unknown:       │ │
              │  │       └─ no transition       │ │
              │  │ 7. FunnelEvent (analytics)   │ │
              │  └─────────────────────────────┘ │
              │                                  │
              │  → HTTP 200                      │
              │                                  │
              │  8. after():                     │
              │     ├─ oversold refundOut         │
              │     ├─ overpay refundOut          │
              │     └─ notification dispatch      │
              └──────────────────────────────────┘
```

---

## Appendix B: PSP Comparison Matrix

| Dimension | MoMo | VNPay | Bank Transfer (VietQR + SePay) |
|-----------|------|-------|-------------------------------|
| **Webhook type** | IPN (server-to-server) | IPN + Return URL (dual) | SePay webhook (push-based, 5-30s) |
| **Auth method** | HMAC SHA-256 | HMAC SHA-512 | Bearer token |
| **Retry schedule** | 1, 3, 5, 10, 15 min | PSP-managed | SePay-managed |
| **Retry window** | 15 minutes | PSP-managed | SePay-managed |
| **Settlement** | T+1 to T+2 | T+1 (same-day premium available) | T+0 (instant — money arrives directly in bank account) |
| **Transaction fee** | 1.5-2.5% MDR | 0.5-1.5% MDR | 0đ (free domestic transfer) + ~100-500k VND/month SePay |
| **Refund API** | Yes (AIO endpoint) | Yes (programmatic reversal) | None (manual bank transfer) |
| **Chargeback** | MoMo-mediated (internal SLA) | NAPAS timeline (45–90 days) | None (bank transfer) |
| **Chargeback fee** | N/A | VND 200K–500K per dispute | N/A |
| **Sandbox** | Same-day signup | 5–15 day testing gate | PAYMENTS_STUB mode |
| **E-wallet cap** | VND 100M/month per user | N/A (card/bank) | N/A (bank transfer) |
| **Biometric trigger** | ≥ VND 10M single tx | N/A | N/A |
| **Production approval** | 5–15 business days | 5–15 business days | SePay signup + Agribank connection |
| **Dispute resolution** | MoMo-mediated | NAPAS (up to 45 days) | N/A |
| **API endpoint** | `developers.momo.vn/v3` | VNPay gateway | SePay webhook to `/api/payments/bank_transfer/webhook` |
| **Integration priority** | First (launch) | Second (Month 1-3) | Third (alongside VNPay) |

---

## Appendix C: Chargeback Risk Analysis

### Current Exposure

The platform settles at T+1 (operator funds available `completedAt + 1 day`). VNPay card-network chargebacks have a 45–90 day window. This creates a 44–89 day exposure window where disbursed funds may need to be clawed back from operators.

### Missing Components

| Component | Status | Impact |
|-----------|--------|--------|
| `paid → chargeback` booking state | Not in state machine | Cannot track disputed bookings |
| Admin chargeback queue | Not built | No notification to ops team when chargeback arrives |
| `chargeback_debit` ledger entry type | Not in enum | Cannot record chargeback in double-entry ledger |
| Operator chargeback notification | Not built | Operator unaware of dispute |
| Chargeback reserve (holdback %) | Not implemented | No buffer against clawback |
| Chargeback rate monitoring | Not implemented | Cannot detect operators with suspicious dispute patterns |

### Mitigation Options (Not Yet Decided)

| Option | Trade-off |
|--------|-----------|
| **Extend settlement delay** past chargeback window (45+ days) | Eliminates financial risk but destroys operator cash flow — competitive disadvantage vs VeXeRe/redBus T+1 settlement |
| **Holdback reserve** (5–10% of settlement withheld for 90 days) | Moderate protection with moderate cash flow impact; standard industry practice |
| **Insurance/guarantee fund** | Platform absorbs chargeback cost up to threshold; requires capital allocation |
| **Per-operator risk scoring** | Dynamic holdback based on chargeback history; requires data accumulation |

### Recommendation

Implement a holdback reserve at launch (5% withheld for 90 days). This is the industry-standard approach for marketplace platforms with T+1 settlement. The reserve percentage can be adjusted per-operator based on chargeback history once sufficient data accumulates.

**Source:** regulatory/psp-contract-terms.md, domain-model/invariants-catalog.md.
