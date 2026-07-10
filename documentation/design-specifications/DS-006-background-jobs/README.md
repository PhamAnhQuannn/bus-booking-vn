# DS-006 -- Background Jobs Design

## 1. Overview

This document defines the background job architecture for the BusBooking platform — a multi-tenant Vietnam bus booking marketplace that must process hold expiry, payment settlement, notification dispatch, e-invoice submission, recurring trip generation, and regulatory compliance sweeps within strict latency and correctness constraints. Background jobs are the mechanism by which time-triggered business logic executes outside the request-response cycle; their reliability determines seat availability accuracy, operator cash flow, regulatory compliance, and customer trust.

**Source ADRs.** This document synthesizes decisions from ADR-002 (NFR Targets), ADR-005 (Payment Architecture), ADR-007 (Observability), ADR-008 (Security Posture), ADR-009 (Concurrency/Seat-Holding), ADR-010 (Booking Lifecycle), ADR-012 (Background Jobs — primary source), ADR-013 (Notification Architecture), ADR-014 (E-Invoice Compliance), ADR-019 (State Machines), ADR-020 (Deployment). Business context from domain-model/event-flows.md, domain-model/state-machines.md, domain-model/invariants-catalog.md, regulatory/einvoice-tax.md, regulatory/payment.md, regulatory/data-privacy.md, market-research/risk-register.md, personas/investor-kpis.md, personas/operator-personas.md.

**Cross-references.** 01-data-model-design for entity schemas, indexes, and cron predicate columns. 03-api-contract §10 for cron route table, auth, and response contract. 04-api-versioning §6 for S1-frozen constraints on cron-touched models. 05-webhook-design for `after()` acceleration pattern and webhook-to-cron handoff points.

---

## 2. Infrastructure Architecture

### 2.1 Scheduled Cron + Database-as-Queue

Background jobs run on **scheduled cron + database-as-queue** — PostgreSQL tables are polled via scheduled HTTP invocations of Next.js API routes. The cron **trigger** is decoupled from job **logic**: any scheduler that can make authenticated HTTP requests on a schedule works identically.

| Property | Value |
|----------|-------|
| Scheduler | Vercel Cron (`vercel.json`) |
| Queue | PostgreSQL tables (Hold, NotificationLog, Payout, EInvoice, etc.) |
| Handler runtime | Origin (Node.js) — full Prisma/DB access |
| Execution metadata | `JobRunLog` model per invocation |
| Minimum cron resolution | 1 minute |
| Max function duration | 300 seconds (Vercel Pro) |
| Persistent workers | None at Stage 0. |

Schedules are declared in `vercel.json`. Vercel invokes each route on schedule and injects `Authorization: Bearer <CRON_SECRET>`.

**Why database-as-queue.** The platform has ~16 known background jobs — a bounded set, not an unbounded stream. Every job already operates on PostgreSQL state (Hold rows, Payout rows, NotificationLog rows). The database IS the queue. External schedulers (Trigger.dev, Inngest) add vendor dependency and potential cross-border data transfer concerns.

**Stage 1 evolution trigger.** When jobs exceed 30-second latency or admin needs stronger isolation: add BullMQ worker process consuming the same `lib/<domain>/` job handlers; add read replica.

**Source:** ADR-012 D1, ADR-020 D7, ADR-020 D9, DS-017 §5.

### 2.2 Cron Endpoint Security

All cron routes live under `/api/cron/**` and are authenticated via a **cron secret header** — not session cookies, not JWT, not HMAC. The cron secret is a first-class environment variable (`CRON_SECRET`).

| Control | Implementation |
|---------|---------------|
| Auth | `Authorization: Bearer <CRON_SECRET>` header. Vercel injects this automatically. |
| CSRF | Not applicable (server-to-server) |
| Rate limiting | IP-based at Edge (same as all `/api/**` routes) |
| External access | Not externally reachable without secret |
| Secret rotation | 90-day rotation cron alert; rotation runbook per ADR-008 D7 |

**Source:** ADR-008 D7, ADR-020 D5, DS-017 §6.2, 03-api-contract §10.

### 2.3 Response Contract

All cron routes return a uniform JSON response:

```json
{
  "job": "<jobName>",
  "status": "success",
  "rowsAffected": 42,
  "durationMs": 1250
}
```

On failure, `status` is `"failed"` with an `errorMessage` field. On lock contention (all rows locked by a concurrent invocation), `status` is `"skipped_locked"`.

**Source:** 03-api-contract §10.

---

## 3. Job Trigger Pattern

### 3.1 Hybrid: `after()` for Latency-Sensitive + Cron for Sweeps

The platform uses a **hybrid trigger pattern**:

| Pattern | Use Case | Guarantee | Latency |
|---------|----------|-----------|---------|
| `after()` | Booking confirmation SMS, OTP dispatch, refund initiation | Best-effort (fire-and-forget post-response) | Sub-second |
| Cron sweep | Hold expiry, payout settlement, e-invoice submission, reconciliation | Guaranteed (database poll on schedule) | Up to cron interval |
| `after()` + cron catch-up | Notification dispatch | `after()` for speed, cron for reliability | Sub-second typical, up to 1 min worst-case |

**Critical rule:** `after()` fires immediately after the HTTP response is sent — it is a best-effort accelerator. If `after()` fails (cold-start crash, function timeout), the cron sweep picks up the pending row on its next invocation. The cron is the guaranteed delivery path; `after()` is an optimization.

**Financial operations must NOT use `after()`.** Payout settlement, ledger writes, and any operation requiring `SELECT FOR UPDATE` must run via cron-triggered execution only — these require full ACID transactions and must be auditable via `JobRunLog`.

**Source:** ADR-012 D2.

### 3.2 `after()` Side Effects

| Side Effect | Trigger Point | Cron Catch-Up |
|-------------|---------------|---------------|
| Booking confirmation SMS/ZNS | Payment webhook → `applyPaidStatusTransition` | `notificationDispatch` (1 min) |
| Operator new-booking notification | Payment webhook → `applyPaidStatusTransition` | `notificationDispatch` (1 min) |
| OTP SMS dispatch | `/api/auth/otp/send` | `notificationDispatch` (1 min) |
| Trip cancellation SMS | `cancelTrip` → NotificationLog per affected booking | `notificationDispatch` (1 min) |
| Operator status change SMS+email | `transitionOperatorStatus` | `notificationDispatch` (1 min) |
| Oversold refund | Payment webhook → `refundOut` (keyed `oversold_race:<bookingId>`) | `refundRetry` (5 min) |
| Overpay refund | Payment webhook → `refundOut` (keyed `overpay_difference:<bookingId>`) | `refundRetry` (5 min) |

### 3.3 OTP Dispatch Model Conflict

Three conflicting descriptions exist for the same operation:

| Source | Description |
|--------|------------|
| ADR-012 D2 | OTP SMS is `after()`-accelerated with cron catch-up |
| ADR-013 D4 | Cron-only outbox pattern — routes only enqueue, never dispatch in-process |
| Actual code | Inline `sendSms()` within the OTP send route — neither `after()` nor cron |

**Status:** Functional but inconsistent documentation. Post-launch cleanup.

**Source:** ADR-012 Conflict Note.

---

## 4. Job Catalog

### 4.1 Cron-Triggered Sweepers

| # | Job | Route | Schedule | Table | WHERE Predicate | Batch |
|---|-----|-------|----------|-------|-----------------|-------|
| 1 | `expireHolds` | `/api/cron/expire-holds` | Every 1 min | Hold | `status = 'active' AND expiresAt < NOW()` | 500 |
| 2 | `notificationDispatch` | `/api/cron/notification-dispatch` | Every 1 min | NotificationLog | `status = 'pending' AND (nextAttemptAt IS NULL OR nextAttemptAt <= NOW())` | configurable |
| 3 | `settlePayout` | `/api/cron/settle-payout` | Every 5 min | Payout | `status = 'requested' AND scheduledAt <= NOW()` | configurable |
| 4 | `autoCompleteTrips` | `/api/cron/auto-complete-trips` | Every 15 min | Trip | `status = 'departed'` past expected arrival window | configurable |
| 5 | `charterExpirySweeper` | `/api/cron/charter-expiry` | Every 15 min | CharterRequest | `PUBLISHED` past `claimByAt` OR `ASSIGNED_DIRECT` past `acceptByAt` | configurable |
| 6 | `einvoiceSubmission` | `/api/cron/einvoice-submission` | Every 5 min | EInvoice | `status = 'pending'` | configurable |
| 7 | `ticketPdfGeneration` | `/api/cron/ticket-pdf-generation` | Every 5 min | Booking | `status = 'paid' AND ticketPdfKey IS NULL` | configurable |
| 8 | `refundRetry` | `/api/cron/refund-retry` | Every 5 min | Refund | `status = 'failed' AND nextRetryAt <= NOW()` | configurable |
| 9 | `24hSmsReminder` | `/api/cron/24h-reminder` | Periodic | Booking | `status IN ('paid', 'awaiting_payment') AND reminderSentAt IS NULL` + trip within 24h window | configurable |
| 10 | `paymentReconSweeper` | `/api/cron/payment-recon` | Every 30 min | PaymentEvent | **Optional backup** — catches orphaned bank transfers where SePay webhook missed or bookingRef extraction failed (~5%). Primary confirmation is SePay webhook (DS-013). | configurable |
| 11 | `generateFromTemplate` | `/api/cron/generate-from-template` | Daily (early morning VN time) | RecurringTripTemplate | Active templates within `validFrom`–`validUntil`, `deactivatedAt IS NULL` | per template |
| 12 | `operatorLicenseAlert` | `/api/cron/operator-license-alert` | Daily | KybDocument | `type = 'business_license' AND expiryDate <= NOW() + 60 days AND expiryAlertSentAt IS NULL` | configurable |
| 13 | `piiAnonymization` | `/api/cron/pii-anonymization` | Daily | Booking + Customer | `snapshotAnonymizedAt IS NULL` + 5-year retention window past | configurable |
| 14 | `kybDocumentPurge` | `/api/cron/kyb-doc-purge` | Periodic | KybDocument | `purgedAt IS NULL` + operator REJECTED/SUSPENDED 90+ days | configurable |
| 15 | `complaintSlaMon` | `/api/cron/complaint-sla-monitor` | Hourly | Complaint | `status IN ('open', 'acknowledged', 'in_progress') AND slaDeadline <= NOW()` | configurable |
| 16 | `subscriptionBilling` | `/api/cron/subscription-billing` | Daily | OperatorSubscription | `status = 'active' AND nextBillingAt <= NOW()` | configurable |

### 4.2 Scheduled Notification Dispatch (S19 Payout)

A specialized variant of `notificationDispatch` handles future-scheduled notifications:

| Property | Value |
|----------|-------|
| Predicate | `template = 'payout_scheduled' AND scheduledFor <= NOW()` |
| Index | `@@index([template, scheduledFor])` on NotificationLog |
| Created by | `markCompleted` → writes `NotificationLog` with `scheduledFor = completedAt + 1 day` |
| Rule | `scheduledFor` is a **top-level indexed column**, never a JSON payload key (Mistake Log Issue 014) |

**Source:** ADR-012 Job Catalog, ADR-013 D5, Mistake Log Issue 014.

---

## 5. Concurrency & Batch Processing

### 5.1 `FOR UPDATE SKIP LOCKED`

All cron sweepers use `FOR UPDATE SKIP LOCKED` batch processing:

```sql
SELECT id FROM "Hold"
WHERE status = 'active' AND "expiresAt" < NOW()
ORDER BY "expiresAt" ASC
LIMIT 500
FOR UPDATE SKIP LOCKED
```

| Property | Value | Rationale |
|----------|-------|-----------|
| Lock mode | `SKIP LOCKED` (non-blocking) | Multiple concurrent cron invocations safely process different rows — no contention, no double-processing |
| Batch size | 500 rows per transaction | Limits transaction duration; each batch commits independently |
| Failure isolation | Per-batch | If one batch fails, already-committed batches are not rolled back |
| Tet scaling | Safe at 10–20x volume | Concurrent Vercel invocations process different rows via `SKIP LOCKED` |

### 5.2 Rejected Concurrency Alternatives

| Alternative | Rejection Reason |
|-------------|-----------------|
| `pg_advisory_lock` | Can cause connection pool exhaustion under PgBouncer |
| Redis distributed lock | Redis downtime would prevent ALL background jobs from running; rate limiter already fails open (risk-matrix.md #13) — compounds risk |
| BullMQ | Requires persistent worker process; Vercel has none |
| Transactional outbox (CDC/Debezium) | Requires persistent consumer; Vercel has none |

### 5.3 Hold Expiry Batch Sizing Rationale

| Batch Size | Tet-Peak Clearance (2,000 expired holds) | Assessment |
|------------|------------------------------------------|------------|
| 50 | 40 iterations × 1 min = 40 minutes | Stale capacity blocked for 40 extra minutes |
| **500 (chosen)** | **4 iterations × 1 min = 4 minutes** | Acceptable transaction duration; `SKIP LOCKED` prevents blocking concurrent hold-creation |
| 1,000 | 2 iterations | Transaction duration risk; 1,000 locked rows increase deadlock potential with concurrent advisory locks |

**Source:** ADR-012 D3, ADR-002 H.

---

## 6. Failure Handling & Retry

### 6.1 At-Least-Once with Idempotency Guards

All background jobs use **at-least-once delivery** with idempotency guards at the data layer:

| Guard | Mechanism | Prevents |
|-------|-----------|----------|
| `PaymentEvent @@unique([adapter, providerTxnId])` | P2002 unique violation → no-op | Double payment processing from webhook replays |
| `LedgerEntry.sourceEventId` unique constraint | P2002 → no-op | Double-crediting from retry |
| `Hold.holdId` ON CONFLICT DO NOTHING | Upsert → no-op | Duplicate hold creation |
| `Trip.completedAt IS NOT NULL` early return | State check → no-op | Double trip completion |
| `Payout findFirst` dedup | Query-before-insert | Duplicate payout creation |
| `NotificationLog @@unique([bookingId, template])` | Partial unique (WHERE bookingId IS NOT NULL) | Duplicate notification enqueue |
| `RecurringGenerationLog` partial unique index | `UNIQUE ON (templateId, date)` | Double trip generation on retry |
| Refund idempotency keys | `sourceEventId` pattern: `cancel:<tripId>:<bookingId>`, `oversold_race:<bookingId>`, `overpay_difference:<bookingId>` | Double refund |

**At-most-once rejected.** Lost booking confirmation SMS destroys customer trust. Lost payout settlement means operator not paid (churn trigger #2). Lost e-invoice submission is GDT non-compliance (Decree 70/2025).

**Source:** ADR-012 D4.

### 6.2 Notification Retry with Exponential Backoff

`NotificationLog` has built-in retry tracking:

| Field | Purpose |
|-------|---------|
| `attemptCount` | Incremented on each dispatch attempt |
| `nextAttemptAt` | Pushed forward with exponential backoff on failure |
| `lastError` | Failure reason for debugging |
| `status` | `pending` → `sent` (success) or `failed` (max attempts exceeded, admin review) |

Cron predicate: `status = 'pending' AND (nextAttemptAt IS NULL OR nextAttemptAt <= NOW())`.

Channel waterfall: ZNS primary (~200–500 VND/msg) → SMS fallback after 60-second ZNS failure (~300–800 VND/msg) → email (supplementary via Resend). Dual-channel saves 50–70% over SMS-only.

**Implementation status:** ZNS not yet integrated. eSMS functions as primary channel.

**Source:** ADR-012 D6, ADR-013 D4, ADR-013 D5.

### 6.3 Payout Failure Path

Failed payouts transition to `status = 'failed'` with `failureReason`. Recovery is **human-in-the-loop**: admin retries via `retryPayout` (`failed → requested`), which re-enters the settlement pipeline. This is intentional — payout is the highest-stakes operation (money movement) and warrants manual review before retry.

**Source:** ADR-012 D4, ADR-012 D5.

### 6.4 Refund Retry

`Refund` model has its own retry mechanism:

| Field | Purpose |
|-------|---------|
| `retryCount` | Incremented per attempt |
| `nextRetryAt` | Next eligible retry (exponential backoff) |
| `failureReason` | PSP error for debugging |
| `pspRefundRef` | PSP-side refund reference on success |

Cron predicate: `status = 'failed' AND nextRetryAt <= NOW()`.

**Source:** 01-data-model-design (Refund entity).

---

## 7. Payout Settlement Pipeline

### 7.1 Two-Phase Pipeline

Payout settlement is a **two-phase** process:

```
Phase 1: SELECT + transition to 'processing'
  │  Cron sweeps: status='requested' AND scheduledAt <= NOW()
  │  FOR UPDATE SKIP LOCKED
  │  UPDATE status → 'processing'
  │  (prevents next cron from re-selecting same payouts)
  │
Phase 2: Per-payout settlement
  │  For each 'processing' payout:
  │  ├─ Verify PayoutAccount.verifiedAt IS NOT NULL
  │  │  └─ If unverified → status='failed', failureReason='account_unverified'
  │  ├─ Call PSP bank transfer API
  │  │  ├─ Success → status='paid', settledAt=NOW()
  │  │  └─ Failure → status='failed', failureReason=<error>
  │  └─ Each payout settles independently (one failure doesn't block others)
```

### 7.2 Payout State Machine

```
requested ──→ processing ──→ paid
                  │
                  └──→ failed ──→ requested (admin retry)
```

### 7.3 Two Payout Creation Paths

| Path | `scheduledAt` | `tripId` | Trigger |
|------|---------------|----------|---------|
| Auto-sweep | `completedAt + 1 day` | Set (per-trip) | `markCompleted` → creates Payout row + `payout_scheduled` NotificationLog |
| On-demand withdrawal | `NOW()` | `null` | `POST /api/op/payouts/withdraw` → immediately eligible for settlement |

Both paths enter the same `settlePayout` cron pipeline.

### 7.4 Settlement Timing

| Constant | Value | Context |
|----------|-------|---------|
| `SETTLEMENT_DELAY_DAYS` | 1 | T+1 — fastest published settlement in Vietnamese bus booking market |
| `SETTLEMENT_DELAY_SQL_INTERVAL` | `'1 day'` | Used in balance derivation queries |
| Available balance formula | `settled_eligible - paid_out` | `settled_eligible` = SUM of non-payout entries where `trip.status = 'completed' AND completedAt + '1 day' <= NOW()` |
| Minimum withdrawal | 100,000 VND | Floor for on-demand withdrawal |

T+1 directly addresses the #2 operator churn trigger (settlement speed) — faster than VeXeRe's estimated T+7 to T+14.

### 7.5 Verification Gate

`PayoutAccount.verifiedAt IS NOT NULL` must be re-verified at settlement time, not just at withdrawal request. If an operator edits bank account details between request and settlement, `verifiedAt` resets to null — the cron must check and skip to `failed` if unverified.

### 7.6 Tax Withholding (NOT YET IMPLEMENTED)

Effective **1 July 2026** (E-Commerce Law 2025): for individual/household operators, the payout cron must withhold VAT ~3% + PIT ~1.5% from settlement amount. Schema columns exist (`taxVat`, `taxPit`, `taxTotal` on Payout; `taxClassification` on Operator; `tax_withheld` in `LedgerEntryType`), but no service functions implement the calculation. `calcWithholding()` and `applyWithholding()` are absent from the payout flow.

The withholding calculation must use BigInt arithmetic (same as platform fee) — fractional rates applied to integer VND amounts.

### 7.7 Known Gap: Payout `processing` Stranding

If a payout transitions to `processing` and the cron function crashes or times out before confirming `paid`/`failed`, the payout stays in `processing` indefinitely. No automatic recovery or timeout-based cleanup for stranded `processing` payouts is documented. Admin must manually investigate and retry. **Go-live blocker.**

### 7.8 Known Gap: Payout Column Overflow

`Payout.grossVnd`, `feeVnd`, `netVnd`, `taxVat`, `taxPit`, `taxTotal` columns are `Int` (32-bit, max ~2.1B VND ~ $84K). A single busy operator's aggregate payout could overflow. Migration to `BigInt` columns required before any single payout batch exceeds this threshold.

**Source:** ADR-012 D5, ADR-005 D3, ADR-006 D5, ADR-010 D5.

---

## 8. Notification Delivery

### 8.1 Cron-Only Outbox Pattern

All domains produce `NotificationLog` rows with `status = 'pending'`. The `notificationDispatch` cron is the **sole delivery path** — routes and webhooks only enqueue, never dispatch in-process.

**Critical invariant:** Notification failure must NEVER affect booking state. The booking is `paid` because the payment webhook confirmed it. If SMS fails, the booking is still paid.

**Rationale:** Synchronous notification sending inside a webhook handler risks webhook timeout, causing PSP retry storms that compound the problem. Side effect coupling in one transaction means a notification failure could roll back a status change — mitigated by enqueue-only in transaction, dispatch via cron.

### 8.2 `after()` Acceleration

`after()` fires immediately after the webhook's HTTP 200 response is sent, attempting best-effort notification dispatch within seconds. If `after()` fails silently (cold-start crash, timeout), the 1-minute cron sweep picks up the pending `NotificationLog` row on its next invocation.

The 60-second notification delivery target (from user research) drives this pattern: customers expect booking confirmation SMS within 60 seconds of payment.

### 8.3 Channel Hierarchy

ZNS (primary, ~200–500 VND/msg) → SMS fallback after 60-second ZNS failure (~300–800 VND/msg) → email (supplementary via Resend).

Channel selection logic lives in the dispatch function, not the enqueue path.

**Implementation status:** ZNS not yet integrated. eSMS SMS functions as primary channel. Email via Resend implemented.

### 8.4 I9 Invariant: Phone Segregation

- `NotificationLog.recipient` carries the phone number for delivery.
- The `payload` JSON field **must never contain the phone number** — prevents double-exposure if payload is logged or exported.
- Every `NotificationLog` INSERT places phone only in `recipient`.

### 8.5 Webhook-Triggered Notifications

| Template | Channel | Trigger | Content |
|----------|---------|---------|---------|
| `customerBookingPaid` | ZNS/SMS | `awaiting_payment → paid` | Booking confirmation with booking ref, route, departure time |
| `operatorNewBooking` | ZNS/SMS | `awaiting_payment → paid` | New booking notification with passenger count, revenue |
| `payout_scheduled` | ZNS/SMS | `departed → completed` | Payout scheduled notification with `scheduledFor = completedAt + 1 day` |

### 8.6 eSMS Tet Risk

eSMS downtime during Tet is an identified risk (stakeholder-map.md). Retry via `nextAttemptAt` backoff handles transient failures.

**Source:** ADR-012 D6, ADR-013 D4, ADR-013 D5, ADR-013 D7.

---

## 9. E-Invoice Submission

### 9.1 Async MISA Integration

When a booking transitions to `paid` via webhook, an `EInvoice` row is created with `status = 'pending'` inside the same `$transaction`. Submission to MISA meInvoice is fully asynchronous — the `einvoiceSubmission` cron (every 5 minutes) is the sole MISA caller.

Decree 123/2020 allows next-business-day issuance. Same-day issuance is best practice, not a legal hard deadline. The 5-minute cron interval makes same-day issuance the normal path; MISA unavailability causes retry without state corruption.

### 9.2 EInvoice State Machine

| From | To | Trigger |
|------|-----|---------|
| *(creation)* | `pending` | Booking reaches `paid` status |
| `pending` | `issued` | Submitted to MISA; sets `invoiceNumber`, `issuedAt` |
| `issued` | `sent` | Delivery confirmed |
| `pending` | `failed` | Submission failure (queued for retry by cron) |
| `issued` / `sent` | `cancelled` | Voided — a NEW EInvoice row is created for corrected invoice (immutability) |

### 9.3 Invoice Types

| Type | Issuer → Recipient | Trigger | Frequency |
|------|-------------------|---------|-----------|
| Ticket invoice | Operator → Customer | Payment webhook (per booking) | Per transaction |
| Commission invoice (B2B) | Platform → Operator | Monthly settlement | Monthly (**NOT YET IMPLEMENTED** — known gap) |

Ticket invoice shows operator as seller (with operator's MST/tax code). Platform can issue on operator's behalf under Decree 123 Art. 17 (expanded by Decree 70/2025), requiring formal written agreement + GDT notification.

### 9.4 Compliance Gap

Transport-specific fields required by Decree 70/2025 (`vehiclePlateNumber`, `departureCityCode`, `destinationCityCode`, operator MST) are **NOT YET MAPPED** into the MISA invoice payload. Go-live blocker.

**Source:** ADR-014 D1, ADR-014 D2, regulatory/einvoice-tax.md, 05-webhook-design §9.

---

## 10. Hold Expiry

### 10.1 Sweeper Mechanics

The `expireHolds` cron transitions `active` holds past `expiresAt` to `expired`, restoring seat capacity.

| Property | Value |
|----------|-------|
| Schedule | Every 1 minute |
| Batch size | 500 |
| Lock mode | `FOR UPDATE SKIP LOCKED` |
| TTL | `HOLD_TTL_MINUTES = 10` (`expiresAt = NOW() + 10min` at creation) |
| Side effect | Also transitions linked `awaiting_payment` bookings to `payment_failed_expired` |

### 10.2 Capacity Impact

Without hold expiry, abandoned holds permanently reduce available seat capacity — causing phantom "sold out" states. During Tet surge (10–20x volume), reliable hold expiry is critical: 2,000 abandoned holds at batch-500 clears in 4 minutes.

### 10.3 HOLD_SWEEPER_MODE

**Implementation status:** `HOLD_SWEEPER_MODE` defaults to `'update'` (active sweep — expires holds and releases capacity). Dev `.env.local` overrides to `'count'` (dry-run). Valid values: `'count'` | `'update'`.

**Required action:** Verify production env does not override `HOLD_SWEEPER_MODE` to `'count'`.

**Source:** ADR-009 D4, ADR-012 Job Catalog, domain-model/invariants-catalog.md.

---

## 11. Recurring Trip Generation

### 11.1 Template-Based Generation

The `generateFromTemplate` cron runs daily (early morning Vietnam time), generating `Trip` rows for a **14-day rolling horizon** from `RecurringTripTemplate` rows.

| Property | Value |
|----------|-------|
| Schedule | Daily |
| Horizon | 14 days rolling |
| Timezone | `Asia/Ho_Chi_Minh` (template `departureLocalTime` is `HH:MM` local) |
| Day filter | `daysOfMask` bitmask (Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64) |
| Template scope | `validFrom` ≤ date ≤ `validUntil`, `deactivatedAt IS NULL` |
| Deduplication | `RecurringGenerationLog` partial unique index prevents double-generation |
| Business logic | All `createTrip` guards apply: bus overlap, maintenance window, operator scope |

### 11.2 Failure Mode

If cron misses a day, no trips are generated for that date. Gaps in bookable inventory are invisible to customers until the next cron run.

### 11.3 Tet Horizon Limitation

14-day window is insufficient for 1–3 month advance Tet booking. Operators must manually create Tet trips or the horizon parameter must be seasonally adjusted.

**Source:** ADR-011 D5, ADR-012 Job Catalog, domain-model/bounded-contexts.md.

---

## 12. Auto-Complete Trips

### 12.1 Mechanics

The `autoCompleteTrips` cron transitions `departed` trips past their expected arrival window to `completed`.

| Property | Value |
|----------|-------|
| Schedule | Every 15 minutes |
| Predicate | `status = 'departed'` AND `departedAt + route.durationMinutes + buffer > NOW()` |
| Idempotency | `completedAt IS NOT NULL` → `{ alreadyCompleted: true }` (no-op) |

### 12.2 Side Effects (on completion)

All side effects execute atomically within the same `$transaction`:

| Side Effect | Details |
|-------------|---------|
| Trip status update | `status = 'completed'`, `completedAt = NOW()` |
| Payout row creation | `Payout(status='requested', scheduledAt = completedAt + 1 day)` |
| Payout notification | `NotificationLog(template='payout_scheduled', scheduledFor = completedAt + 1 day)` |

**Source:** ADR-012 Job Catalog, ADR-019 D7, domain-model/event-flows.md.

---

## 13. Charter Expiry

The `charterExpirySweeper` cron transitions stale charter requests:

| From | To | Condition |
|------|----|-----------|
| `PUBLISHED` | `EXPIRED` | `claimByAt < NOW()` (public pool claim deadline passed) |
| `ASSIGNED_DIRECT` | `ADMIN_REVIEW` | `acceptByAt < NOW()` (direct-assign accept deadline passed); clears `assigneeOperatorId`, `acceptByAt`, `claimByAt` |

If this cron fails, stale charter requests accumulate and are never resolved.

**Source:** ADR-012 Job Catalog, domain-model/state-machines.md.

---

## 14. Data Retention & Anonymization

### 14.1 Retention Tiers

Five retention tiers requiring automated sweep jobs:

| Tier | Retention | Data | Sweep Action |
|------|-----------|------|-------------|
| T1 Security ephemeral | 90 days | OTP attempt logs, session tokens | Delete |
| T2 Operational | 24 months | App logs, FunnelEvent, JobRunLog, NotificationLog | Archive/delete |
| T3 Financial | 5 years | Booking, LedgerEntry, Payout, PaymentEvent | Retain; anonymize PII |
| T4 Tax/e-invoice | 10 years | EInvoice records, tax summaries | Retain in original electronic form |
| T5 Compliance | 5 years post-breach | Breach records, DSAR logs, ConsentRecord | Retain |

Domain-partitioned audit tables enable per-table retention policies. Each table maps to exactly one retention tier. Sweep jobs can target individual tables without cross-table dependency.

### 14.2 PII Anonymization Sweeper

The `piiAnonymization` cron replaces T1 PII (name, phone, email) with anonymized values on Booking/Customer records after the 5-year retention period per PDPL 2025. Financial data (LedgerEntry, PaymentEvent) is retained for 5–10 years per Accounting Law — ledger amounts persist but PII is anonymized.

Predicate: `snapshotAnonymizedAt IS NULL` + retention window past.

### 14.3 KYB Document Purge

The `kybDocumentPurge` cron removes stored document objects for operators that have been REJECTED or SUSPENDED for 90+ days.

Predicate: `purgedAt IS NULL` + operator status check.

### 14.4 Data Localization

All background-job-processed data is stored in Vietnam-hosted PostgreSQL. If `JobRunLog` entries or cron execution logs flow through overseas APM tools (Vercel, Sentry), that constitutes a cross-border transfer under PDPL 2025 — requiring a CDTIA filing with A05 within 60 days.

**Source:** ADR-007 D7, ADR-008 D9, regulatory/data-privacy.md.

---

## 15. Complaint SLA Monitoring

The `complaintSlaMon` cron (hourly) detects complaints that have breached their SLA deadline:

| Property | Value |
|----------|-------|
| Predicate | `status IN ('open', 'acknowledged', 'in_progress') AND slaDeadline <= NOW()` |
| SLA computation | `slaDeadline = createdAt + 3 business days` (Consumer Protection Law 2023) |
| Action | Escalate to admin; update `escalatedAt` |

**Source:** 01-data-model-design (Complaint entity), regulatory/consumer-protection.md.

---

## 16. State Machine Transitions Triggered by Background Jobs

### 16.1 Complete Transition Map

| Job | Model | From → To | Condition |
|-----|-------|-----------|-----------|
| `expireHolds` | Hold | `active → expired` | `expiresAt < NOW()` |
| `expireHolds` | Booking | `awaiting_payment → payment_failed_expired` | Hold expiry cascade |
| `autoCompleteTrips` | Trip | `departed → completed` | Past expected arrival window |
| `autoCompleteTrips` | Payout | *(creates)* `requested` | Trip completion creates payout row |
| `settlePayout` | Payout | `requested → processing` | `scheduledAt <= NOW()` |
| `settlePayout` | Payout | `processing → paid` | Bank transfer confirmed |
| `settlePayout` | Payout | `processing → failed` | Bank transfer rejected |
| `charterExpirySweeper` | CharterRequest | `PUBLISHED → EXPIRED` | `claimByAt < NOW()` |
| `charterExpirySweeper` | CharterRequest | `ASSIGNED_DIRECT → ADMIN_REVIEW` | `acceptByAt < NOW()` |
| `einvoiceSubmission` | EInvoice | `pending → issued` | MISA submission success |
| `einvoiceSubmission` | EInvoice | `pending → failed` | MISA submission failure |
| `refundRetry` | Refund | `failed → processing` | `nextRetryAt <= NOW()` |
| `refundRetry` | Refund | `processing → completed` | PSP refund confirmed |
| `notificationDispatch` | NotificationLog | `pending → sent` | Dispatch success |
| `notificationDispatch` | NotificationLog | `pending → failed` | Max attempts exceeded |
| `complaintSlaMon` | Complaint | `open/acknowledged/in_progress → escalated` | `slaDeadline <= NOW()` |
| `subscriptionBilling` | OperatorSubscription | `active → past_due` | Billing failure |

### 16.2 Webhook vs Cron vs API-Triggered Transitions (Disambiguation)

| Model | Webhook-Triggered | Cron-Triggered | API-Triggered |
|-------|-------------------|----------------|---------------|
| Booking | `awaiting_payment → paid`, `awaiting_payment → payment_failed_expired` | `awaiting_payment → payment_failed_expired` (hold expiry cascade) | `paid → cancelled`, `paid → no_show`, `paid → trip_cancelled` |
| Hold | `active → consumed` (paid webhook) | `active → expired` | `active → cancelled_trip` |
| Trip | — | `departed → completed` (auto-complete) | `scheduled → departed`, `scheduled → cancelled` |
| Payout | — | `requested → processing → paid/failed` | `failed → requested` (admin retry) |
| EInvoice | — | `pending → issued/failed` | `issued → cancelled` |

**Source:** ADR-019 D2, ADR-019 D7, domain-model/state-machines.md.

---

## 17. Cron Predicate Index Map

Every cron job's WHERE predicate is backed by a composite index for efficient scanning:

| Table | Index | Cron |
|-------|-------|------|
| Hold | `[tripId, status, expiresAt]` | `expireHolds` |
| Hold | `[expiresAt]` | `expireHolds` |
| Booking | `[status, reminderSentAt]` | `24hSmsReminder` |
| Booking | `[snapshotAnonymizedAt]` | `piiAnonymization` |
| Booking | `[tripId, status]` | `ticketPdfGeneration` |
| NotificationLog | `[status, nextAttemptAt]` | `notificationDispatch` |
| NotificationLog | `[template, scheduledFor]` | S19 payout notification dispatch |
| Payout | `[status, scheduledAt]` | `settlePayout` |
| Refund | `[status, nextRetryAt]` | `refundRetry` |
| Trip | `[status, departureAt]` | `autoCompleteTrips` |
| CharterRequest | `[status, acceptByAt]` | `charterExpirySweeper` (direct-assign) |
| CharterRequest | `[status, claimByAt]` | `charterExpirySweeper` (pool expiry) |
| EInvoice | `[status]` | `einvoiceSubmission` |
| KybDocument | `[type, expiryDate]` | `operatorLicenseAlert` |
| KybDocument | `[purgedAt]` | `kybDocumentPurge` |
| Complaint | `[slaDeadline]` | `complaintSlaMon` |
| OperatorSubscription | `[status, nextBillingAt]` | `subscriptionBilling` |
| RecurringGenerationLog | `[templateId]`, `[date]` | `generateFromTemplate` |
| JobRunLog | `[jobName, startedAt]` | Cron execution history |

**Rule:** Any field used as a cron WHERE predicate must be a **top-level indexed column**, never inside a `payload Json` field. Greppable smell: any `payload->>'` or `payload->` in `app/api/cron/**` is a sequential-scan bug waiting to surface at scale.

**Source:** 01-data-model-design §5.1, Mistake Log Issue 014.

---

## 18. Observability

### 18.1 JobRunLog

Every cron invocation writes a `JobRunLog` row:

| Field | Purpose |
|-------|---------|
| `jobName` | Job identifier (matches catalog) |
| `startedAt` | Invocation start |
| `endedAt` | Invocation end (null if crashed) |
| `status` | `success`, `failed`, `skipped_locked` |
| `rowsAffected` | Rows processed in this invocation |
| `errorMessage` | Failure details |

### 18.2 Alert Tiers for Background Jobs

| Tier | Condition | Response SLA |
|------|-----------|-------------|
| **P1 Critical** | All webhooks failing >5 min (no payment processing) | 15 min ack, 1 hr resolution |
| **P2 High** | Payout failure rate >5% per operator | 30 min ack, 4 hr resolution |
| **P2 High** | eSMS delivery failures >10% | 30 min ack, 4 hr resolution |
| **P2 High** | Webhook volume drops >50% from 15-min rolling average | 30 min ack, 4 hr resolution |
| **P3 Medium** | p95 latency >500ms for cron-triggered operations | 2 hr ack, 24 hr resolution |
| **P4 Low** | `JobRunLog` shows cron missed execution | Daily digest, next business day |

During the **2-week Tet window**: P2 response SLA tightens to P1 levels (15 min ack). Threshold baselines switch to Tet-calibrated values (10x multiplier on normal baselines before first Tet data).

### 18.3 Investor KPIs Fed by Background Jobs

| KPI | Target | Background Job Dependency |
|-----|--------|--------------------------|
| GMV (monthly) | $500K–2M (Series A threshold) | `FunnelEvent('booking_paid')` written by webhook; funnel analytics query |
| Payment failure rate | <3% | Webhook processing + `refundRetry` cron |
| Payment abandonment | <25% | Hold expiry cron drives capacity reclaim |
| Overbooking rate | <0.1% | Hold expiry + webhook oversold guard |
| Refund rate | <2% of GMV | `refundRetry` cron + ledger writes |
| Active operators | >60% with ≥1 booking in trailing 30 days | `generateFromTemplate` cron generates inventory |
| On-time departure | >90% within 15 min | `autoCompleteTrips` cron + operator `markDeparted` |
| Commission concentration | <40% from top 5 operators | Revenue reporting queries over LedgerEntry |

### 18.4 Implementation Status

| Component | Status |
|-----------|--------|
| `JobRunLog` writes per cron invocation | Deployed |
| Structured JSON logging (`lib/core/logger.ts`) | Deployed |
| PII redaction at serialization | Deployed |
| Sentry error capture with `beforeSend` PII scrub | **NOT DEPLOYED** |
| BetterStack uptime monitoring (2-min detection) | **NOT DEPLOYED** |
| Webhook volume anomaly alerting | **NOT DEPLOYED** |
| Payment anomaly detection ≤5 min target | **NOT DEPLOYED** |

**Source:** ADR-007 D5, ADR-007 D6, ADR-002 I, personas/investor-kpis.md.

---

## 19. Multi-Tenancy Constraints

### 19.1 Operator Scope in Background Jobs

Background jobs fall into two categories:

| Scope | Jobs | Auth Context |
|-------|------|-------------|
| **Cross-tenant** (admin-level) | `settlePayout`, `notificationDispatch`, `expireHolds`, `einvoiceSubmission`, `paymentReconSweeper`, `piiAnonymization`, `complaintSlaMon`, `refundRetry` | System/cron secret; processes all tenants |
| **Per-tenant** (operator-scoped) | `generateFromTemplate` | Must set correct `operatorId` FK on created Trip rows |

Cross-tenant crons intentionally bypass `withOperatorScope` — they run under the admin context, not an operator context. A cron cannot accept `operatorId` from an untrusted source.

### 19.2 E-Invoice Tenant Identity

Each e-invoice submission must carry the correct per-operator tax identity (MST/tax code, `taxClassification`). A batch-submit cron must correctly scope to the issuing operator's credentials — the platform issues invoices on behalf of operators, not under the platform's own MST.

**Source:** ADR-004 D12, ADR-016 (module boundaries).

---

## 20. Timing Constants

| Constant | Value | Used By | Source |
|----------|-------|---------|--------|
| `HOLD_TTL_MINUTES` | 10 | Hold expiry sweeper (`expiresAt = NOW() + 10min`) | ADR-009 D4 |
| `PSP_WINDOW_MINUTES` | 20 | Capacity formula: `awaiting_payment` bookings within 20 min count against capacity | ADR-009 D5 |
| `SETTLEMENT_DELAY_DAYS` | 1 | Payout `scheduledAt = completedAt + 1 day` (T+1) | ADR-005 D3 |
| Hold expiry cron batch | 500 rows | `expireHolds` transaction size | ADR-002 H |
| Function duration limit | 300s (Vercel Pro) | All cron invocations | ADR-020 |
| Cron resolution floor | 1 minute | Floor for scheduling frequency | ADR-020 |
| Notification delivery target | 60 seconds | From user research; drives `after()` acceleration | ADR-002 |
| ZNS → SMS fallback timeout | 60 seconds | Channel waterfall in dispatch function | ADR-013 D5 |
| E-invoice issuance deadline | At payment time (same-day best practice; next-business-day legal) | `einvoiceSubmission` cron | Decree 123/2020, Decree 70/2025 |
| License expiry alert horizon | 60 days before expiry | `operatorLicenseAlert` cron | ADR-008 D10 |
| PII retention period | 5 years | `piiAnonymization` sweeper | PDPL 2025 |
| E-invoice archival | 10 years | MISA handles archival | Decree 123/2020 |
| Financial records retention | 5 years (Accounting Law) | LedgerEntry, PaymentEvent, Booking | ADR-007 D7 |
| Secret rotation cadence | 90 days | Rotation cron alert | ADR-008 D7 |
| KYB document purge delay | 90 days post-REJECTED/SUSPENDED | `kybDocumentPurge` | ADR-008 D9 |
| Complaint SLA | 3 business days | `complaintSlaMon` cron | CPL 2023 |
| Bus overlap buffer | 60 minutes | `generateFromTemplate` applies overlap guard | ADR-002 H |
| Trip rolling horizon | 14 days | `generateFromTemplate` generation window | ADR-011 D5 |
| Tet surge multiplier | 10–20x normal volume | Batch sizing and concurrency target | ADR-002 |
| OTP TTL | 5 minutes | Not cron-driven; rows become inert naturally | ADR-002 G |
| OTP lockout | 15 minutes | Sentinel row extends `expiresAt`; not cron-driven | ADR-002 G |

---

## 21. Regulatory Constraints on Background Jobs

### 21.1 E-Invoice Timing

| Requirement | Deadline | Source |
|-------------|----------|--------|
| E-invoice issuance | At time of sale (per booking) | Decree 70/2025 |
| Digital signature | Within next working day | einvoice-tax.md |
| Archival in original electronic form | 10 years | Decree 123/2020 |
| Transport-specific fields | Before go-live | Decree 70/2025 (**NOT YET IMPLEMENTED**) |

### 21.2 Tax Withholding

| Requirement | Deadline | Source |
|-------------|----------|--------|
| Withhold VAT ~3% + PIT ~1.5% from individual/household operator payouts | Effective 1 July 2026 | E-Commerce Law 2025 |
| Periodic remittance to GDT | Monthly (typical under VN tax law) | regulatory/payment.md |
| Issue withholding certificates to operators | Per settlement | regulatory/einvoice-tax.md |
| CIT quarterly provisional payments | Quarterly | regulatory/einvoice-tax.md |
| CIT annual finalization | Within 90 days of year-end | regulatory/einvoice-tax.md |

### 21.3 Data Privacy

| Requirement | Deadline | Source |
|-------------|----------|--------|
| PII anonymization after retention period | 5 years (PDPL 2025) | regulatory/data-privacy.md |
| Minimum data retention post-user-departure | 24 months (Decree 53/2022) | regulatory/data-privacy.md |
| Breach notification to A05 | 72 hours (general); 24 hours (cybersecurity attack) | regulatory/data-privacy.md |
| DPIA update | Every 6 months or within 10 days of material change | regulatory/data-privacy.md |
| CDTIA filing for overseas log processing | Within 60 days of first processing | regulatory/data-privacy.md |

### 21.4 Consumer Protection

| Requirement | Deadline | Source |
|-------------|----------|--------|
| Complaint acknowledgment | 3 business days | CPL 2023 |
| Complaint resolution | 7–30 days | CPL 2023 |

### 21.5 PSP Reconciliation

| Requirement | Frequency | Source |
|-------------|-----------|--------|
| Daily/weekly reconciliation and settlement reporting | Ongoing post-launch | compliance-timeline.md |
| VNPay dispute timeline | Up to 45 days (NAPAS) | psp-contract-terms.md |
| FCT withholding remittance (if foreign entity) | 10 days per payment event | ADR-014 D5 |

**Source:** regulatory/einvoice-tax.md, regulatory/payment.md, regulatory/data-privacy.md, regulatory/consumer-protection.md, regulatory/compliance-timeline.md.

---

## 22. NFR Targets

| Metric | Target | Alert Threshold | Source |
|--------|--------|----------------|--------|
| Notification delivery | Within 60 seconds of enqueue | — | ADR-002, market-research/user-insights.md |
| OTP delivery | Effectively immediate (blocking user wait) | — | ADR-013 D4 |
| Payout settlement | T+1 (`completedAt + 1 day`) | — | ADR-005 D3 |
| E-invoice issuance | Same-day (next-business-day legal floor) | — | Decree 123/2020 |
| Hold expiry backlog clearance | 4 minutes at Tet peak (2,000 expired holds) | — | ADR-002 H |
| Payment anomaly detection | ≤5 minutes | Webhook volume drop >50% from 15-min rolling average | ADR-002 I |
| Platform availability | 99.5% monthly (99.9% during Tet) | — | ADR-002 D2 |
| Throughput | 2,000 concurrent booking attempts | — | ADR-002 D3 |
| Payment failure rate | <3% | >3% | ADR-002 G |
| Payout failure rate | — | >5% per operator | ADR-007 D5 |
| External uptime probe | 2-min detection (2 consecutive failures) | — | ADR-002 I |
| Cron function timeout | 300s (Vercel Pro) | — | ADR-020 |

---

## 23. Known Gaps and Implementation Status

| Gap | Category | Risk | Required Before |
|-----|----------|------|----------------|
| `paymentReconSweeper` backup cron not built | Feature | LOW — SePay webhook is primary bank transfer confirmation (DS-013); cron is optional backup for orphaned transfers | Post-launch |
| `HOLD_SWEEPER_MODE` defaults to `update` (active sweep) — RESOLVED | Configuration | RESOLVED — default is now active sweep | Done |
| Payout `processing` stranding (no auto-recovery) | Operations | MEDIUM — crashed cron leaves payout stuck | Go-live |
| Tax withholding (`calcWithholding`, `applyWithholding`) absent | Compliance | HIGH — mandatory 1 July 2026 | Go-live |
| Transport e-invoice fields missing (Decree 70/2025) | Compliance | HIGH — GDT non-compliance | Go-live |
| Commission VAT invoice (platform→operator, monthly B2B) | Compliance | MEDIUM — platform earns commission without issuing invoice | Go-live |
| PSP refund implementation (`lib/payment/refund.ts`) absent | Feature | CRITICAL — no customer refund possible | Go-live |
| `operatorLicenseAlert` cron not built | Feature | MEDIUM — unlicensed operators stay visible | Go-live |
| `piiAnonymization` cron not built | Compliance | MEDIUM — PDPL 2025 non-compliance after 5 years | Post-launch |
| Payout column `Int→BigInt` migration | Data | MEDIUM — overflow at ~2.1B VND ($84K) per batch | Pre-scale |
| Sentry not installed | Observability | MEDIUM — no unhandled exception capture | Go-live |
| BetterStack not deployed | Observability | MEDIUM — 2-min detection target unmet | Go-live |
| Webhook volume anomaly alerting not built | Observability | MEDIUM — ≤5 min detection target unmet | Go-live |
| Chargeback workflow absent | Feature | HIGH — no `paid → chargeback` state, no reserve | Go-live |
| Operator churn early-warning sweep (14-day zero-booking) | Operations | LOW — churn with outstanding bookings undetected | Post-launch |
| OTP dispatch model conflict (3 conflicting descriptions) | Architecture | LOW — functional but inconsistent docs | Post-launch cleanup |
| CDTIA filing for overseas log processing | Compliance | HIGH — 5% revenue penalty | Go-live (if using overseas APM) |
| Schedule mismatches (vercel.json vs catalog) | Operations | LOW — verify vercel.json matches catalog before go-live | Go-live |

---

## 24. Decision Log

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| J1 | Vercel Cron + database-as-queue over external scheduler or BullMQ | 2026-06-19 | ~16 bounded jobs; every job already operates on PG state; external systems add vendor dependency, cross-border data risk, persistent-worker requirement |
| J2 | Hybrid trigger: `after()` for latency-sensitive + cron for sweeps | 2026-06-19 | `after()` delivers sub-second notification; cron guarantees delivery if `after()` fails. Financial operations cron-only for auditability |
| J3 | `FOR UPDATE SKIP LOCKED` for all batch sweepers | 2026-06-19 | Non-blocking concurrent processing; no advisory lock contention; scales with Tet 10–20x surge |
| J4 | Batch size 500 for hold expiry | 2026-06-19 | Clears 2,000 Tet-peak expired holds in 4 minutes; 1,000 risks deadlock; 50 takes 40 minutes |
| J5 | At-least-once with idempotency guards over at-most-once | 2026-06-19 | Lost SMS = trust destruction; lost payout = operator churn; lost e-invoice = GDT non-compliance. Idempotency at data layer makes replay a no-op |
| J6 | Two-phase payout pipeline (requested→processing→paid/failed) | 2026-06-19 | `processing` state prevents double-settlement; per-payout independent settlement; human-in-the-loop retry for failed payouts |
| J7 | Cron-only outbox for notifications (never in-process dispatch) | 2026-06-19 | Notification failure must never affect booking state; synchronous dispatch risks webhook timeout → PSP retry storms |
| J8 | `scheduledFor` as top-level indexed column, never JSON payload | 2026-06-19 | JSON payload key requires non-indexable parse → full table scan at scale. Composite `@@index([template, scheduledFor])` supports efficient cron predicate |
| J9 | Redis deliberately NOT used for job locking | 2026-06-19 | Redis downtime would prevent ALL jobs; rate limiter already fails open (risk #13); compounds single-point-of-failure risk |
| J10 | PayoutAccount.verifiedAt re-checked at settlement, not just withdrawal | 2026-06-19 | Account edits between request and settlement reset `verifiedAt`; cron must catch unverified accounts |
| J11 | 14-day rolling horizon for recurring trip generation | 2026-06-19 | Balances inventory freshness against generation overhead; Tet requires manual override or seasonal horizon expansion |
| J12 | Payout failure recovery is human-in-the-loop (admin retry) | 2026-06-19 | Money movement is highest-stakes operation; automated retry risks double-disbursement on transient PSP errors |

---

## Appendix A: Job Dependency Diagram

```
                    ┌─────────────────────┐
                    │  Payment Webhook     │
                    │  (MoMo / VNPay)      │
                    └─────────┬───────────┘
                              │
                   ┌──────────┼──────────────┐
                   ▼          ▼              ▼
             NotificationLog  EInvoice    FunnelEvent
             (pending)        (pending)   (booking_paid)
                   │          │
                   ▼          ▼
        ┌──────────────┐  ┌──────────────────┐
        │ notification │  │ einvoice         │
        │ Dispatch     │  │ Submission       │
        │ (1 min cron) │  │ (5 min cron)     │
        └──────────────┘  └──────────────────┘

                    ┌─────────────────────┐
                    │  Hold Creation       │
                    │  (customer action)   │
                    └─────────┬───────────┘
                              │ expiresAt = NOW() + 10min
                              ▼
                    ┌─────────────────────┐
                    │  expireHolds         │
                    │  (1 min cron)        │
                    │  active → expired    │
                    └─────────┬───────────┘
                              │ cascade
                              ▼
                    Booking: awaiting_payment
                    → payment_failed_expired

                    ┌─────────────────────┐
                    │  markDeparted        │
                    │  (operator action)   │
                    └─────────┬───────────┘
                              ▼
                    ┌─────────────────────┐
                    │  autoCompleteTrips   │
                    │  (15 min cron)       │
                    │  departed→completed  │
                    └─────────┬───────────┘
                              │ creates
                    ┌─────────┼─────────────┐
                    ▼                       ▼
              Payout                  NotificationLog
              (requested,             (payout_scheduled,
               scheduledAt=           scheduledFor=
               completedAt+1d)        completedAt+1d)
                    │                       │
                    ▼                       ▼
              ┌──────────────┐    ┌──────────────────┐
              │ settlePayout │    │ notification     │
              │ (5 min cron) │    │ Dispatch         │
              │ requested →  │    │ (1 min cron)     │
              │ processing → │    └──────────────────┘
              │ paid/failed  │
              └──────────────┘

                    ┌─────────────────────┐
                    │  generateFromTemplate│
                    │  (daily cron)        │
                    │  RecurringTemplate → │
                    │  Trip rows (14d)     │
                    └─────────────────────┘

                    ┌─────────────────────┐
                    │  charterExpiry       │
                    │  (15 min cron)       │
                    │  PUBLISHED→EXPIRED   │
                    │  ASSIGNED→ADMIN_REV  │
                    └─────────────────────┘
```

---

## Appendix B: Stub Mode Configuration

| Integration | Env Var | Stub Behavior | Real Behavior |
|-------------|---------|---------------|---------------|
| Notifications | `NOTIFY_STUB=true` | Logged but not sent | eSMS/Resend live dispatch |
| E-Invoice | `EINVOICE_ENABLED=stub` | Log only | MISA meInvoice API |
| Payments | `PAYMENTS_STUB=true` | Local stub gateway | MoMo/VNPay live |

Stub modes allow background jobs to run in development without external service dependencies.

**Source:** ADR-020 D5.

---

## Appendix C: BigInt Arithmetic Rules for Background Jobs

Any background job that computes currency amounts (payout settlement, platform fee, tax withholding, refund) must follow these rules:

1. All multiplication of integer VND by a fractional rate uses **BigInt domain** — even when `gross < 2^53`.
2. Platform fee rate stored as `ratePpm` (parts-per-million integer): e.g., `60000` = 6%.
3. **ES2017 constraint:** `BigInt(n)` constructor calls only — `1n`/`2n`/`0n` literal suffixes are parser errors.
4. Exact tie detection: `remainder * BigInt(2) === denominator` (half-even rounding).
5. Only `Number(result)` the final integer at the end.
6. **Greppable bug:** Any `Math.round(<int> * <fractional>)` or `Math.floor(<minor-unit> * <rate>)` in `lib/payouts/**`, `lib/ledger/**`, or any money-handling module is a representation drift bug.

**Source:** ADR-006 D5, Mistake Log Issue 016.

---

## See Also

- [SI-003 CI/CD Pipeline](../../scaffolding-infra/SI-003-ci-cd-pipeline/) — cron endpoint testing in CI, migration safety checks
- [SI-006 Deployment Config](../../scaffolding-infra/SI-006-deployment-config/) — job catalog with schedules, `after()`-accelerated side effects
