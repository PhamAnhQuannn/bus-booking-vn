# ADR-012: Background Jobs

## Status
ACCEPTED

## Date
2026-06-17 (reviewed and confirmed)

## Context

Bus-Booking runs on Vercel serverless infrastructure (ADR-001) with no persistent worker processes. The platform's domain model defines 8 state machines (state-machines.md) with transitions triggered not only by user actions but also by time-based business rules: holds expire after 10 minutes, payouts settle T+1 after trip completion, charter claim deadlines pass, notification delivery must happen within seconds of enqueue, and e-invoices must be issued at payment time (einvoice-tax.md). Without a reliable background job system, these time-sensitive operations either block user requests or never execute at all.

Key business constraints driving background job decisions (sourced from `documentation/business/`):

- **Vercel serverless (sin1)**: No persistent worker processes, no long-lived connections. Vercel Cron supports scheduled function invocation via HTTP endpoints. Application already uses `after()` for post-commit side effects (overpay refund, notification fan-out). (ADR-001, bounded-contexts.md)
- **Hold expiry = lost revenue**: Active holds expire after `HOLD_TTL_MINUTES = 10`. Without a sweeper transitioning expired holds from `active` to `expired`, abandoned holds permanently reduce available capacity and block other customers from booking. Uses `UPDATE ... FOR UPDATE SKIP LOCKED` in batches of 500. (invariants-catalog.md, ubiquitous-language.md)
- **T+1 settlement as competitive differentiator**: Revenue is available only when `Trip.completedAt + 1 day <= NOW()`. Payout rows created at trip completion with `status='requested'` and `scheduledAt = completedAt + 1 day` must be swept and settled reliably. T+1 is the fastest published settlement in the Vietnamese bus booking market -- faster than VeXeRe's estimated T+7 to T+14 and directly addresses the #2 operator churn trigger (settlement speed). (competitor-benchmark/pricing-comparison.md, competitor-benchmark/operator-sentiment.md, event-flows.md, invariants-catalog.md)
- **Notification latency expectations**: Receiving confirmation within 60 seconds separates trusted platforms from unreliable ones. OTP delivery is blocking (user waits for SMS). Zalo ZNS primary channel, SMS fallback, email tertiary. eSMS aggregator already integrated. All domains produce `NotificationLog` rows; the dispatch cron is the sole delivery path. (market-research/user-insights.md, telecom-sms.md, bounded-contexts.md)
- **E-invoice compliance timing**: E-invoice must be issued no later than payment confirmation per Decree 70/2025. MISA meInvoice submission is async but must not lag significantly behind payment. (einvoice-tax.md, stakeholder-map.md)
- **VietQR reconciliation**: Memo truncation or user mistyped reference = money received but no ticket, rated HIGH likelihood x HIGH impact. Issue 095 recon sweeper must flag unmatched payments. (risk-matrix.md, stakeholder-map.md)
- **Tet surge (10-20x volume)**: 260% demand spike at major stations. Background jobs must not become a bottleneck during peak. Permanent customer defection on failure. (risk-matrix.md, market-research/user-insights.md)
- **Charter expiry**: Published charter requests past their claim deadline transition to EXPIRED via `charterExpirySweeper`. Assigned-direct requests past `acceptByAt` need admin re-routing. (state-machines.md, bounded-contexts.md)
- **Auto-complete trips**: Departed trips not manually completed by operator get auto-completed by cron, triggering payout row creation and `payout_scheduled` notification. (state-machines.md, event-flows.md)
- **PII anonymization**: Booking PII anonymization required per PDPL 2025. Booking data retention: 5 years. Anonymization sweeper must run after retention period. (regulatory/data-privacy.md, risk-matrix.md)
- **Operator license expiry**: Transport license (Giay phep kinh doanh van tai) expiry requires cron alert 60 days before expiry. (risk-matrix.md)
- **Small team, pre-launch**: Operational simplicity matters. Speed to market is critical for Series A gate. Building custom infrastructure for background jobs must be weighed against shipping velocity. (ADR-001, investor-kpis.md, market-research/strategic-roadmap.md)
- **Financial integrity**: Append-only ledger, idempotency keys (`sourceEventId` unique constraint on LedgerEntry, `@@unique([adapter, providerTxnId])` on PaymentEvent), BigInt currency math, and `SELECT FOR UPDATE` serialization are non-negotiable invariants for any background process touching money. (invariants-catalog.md)
- **ioredis already integrated**: Redis (Upstash) is available for locking and rate limiting. Advisory locks (`pg_advisory_lock`) available in PostgreSQL. (ADR-001)

---

## Decisions

### 1. Infrastructure Choice -- Vercel Cron + Database-as-Queue

| Option | Pros | Cons |
|--------|------|------|
| **Vercel Cron (cron jobs hitting API routes)** | Zero infrastructure to provision or maintain; deploys with the app; auto-scales with Vercel serverless; no additional billing or vendor; aligns with existing monorepo architecture (ADR-001); cron schedule declared in `vercel.json`; each job is a standard Next.js API route handler with full Prisma/DB access | 1-minute minimum cron resolution (Vercel Cron limitation); no built-in retry/DLQ; no job queue visualization dashboard; cold-start latency on each invocation; 300s max function duration (Vercel Pro) |
| External job scheduler (Trigger.dev, Inngest) | Rich retry semantics, fan-out, step functions, dashboard UI; event-driven triggers; built-in observability | Additional vendor dependency and cost; another failure domain; data leaves the app boundary (cross-border transfer considerations per data-privacy.md); team must learn new SDK; overkill for bounded job set |
| Self-hosted worker (separate Node.js process) | Full control over execution; unlimited duration; can run long-running tasks | Vercel serverless has no persistent process (ADR-001); requires separate hosting (EC2/Railway); operational burden for small team; separate deploy pipeline; defeats monorepo simplicity |
| Message queue (BullMQ + Redis worker) | True async job queue; priority lanes; rate limiting; dashboard (Bull Board) | Requires persistent worker process (not available on Vercel); Redis as job broker adds failure domain; operational complexity; overkill for ~11 known job types |
| Database-as-queue (poll PostgreSQL tables directly) | No additional infrastructure; PostgreSQL already the source of truth; `FOR UPDATE SKIP LOCKED` provides safe concurrent dequeue; all state in one DB; simplest mental model | Polling adds DB load; no built-in priority or retry semantics; requires cron trigger to poll; no fan-out capability |

**Choice**: Vercel Cron + database-as-queue (poll PostgreSQL tables via scheduled API route invocations)

**Reasons**:
- Vercel is the hosting platform (ADR-001). Vercel Cron is the native scheduled execution primitive -- adding an external scheduler introduces a new vendor dependency, a new failure domain, and potential cross-border data transfer if the scheduler is hosted outside Vietnam/Singapore (regulatory/data-privacy.md)
- The platform has a bounded set of ~11 known background jobs, not an unbounded job queue. A dedicated job queue system (BullMQ, Inngest) is designed for unbounded, heterogeneous workloads -- overkill for a finite, well-characterized set (bounded-contexts.md)
- Every background job already operates on PostgreSQL state (Hold rows, Payout rows, NotificationLog rows, Trip rows). Using `FOR UPDATE SKIP LOCKED` to dequeue work from these tables means no additional queue infrastructure -- the database IS the queue. This aligns with the `SKIP LOCKED` pattern already proven in hold expiry (invariants-catalog.md)
- `JobRunLog` model tracks cron execution metadata (bounded-contexts.md). Each cron invocation logs start/end/count/errors -- provides the observability layer without a third-party dashboard
- Small team pre-launch -- operational simplicity matters (ADR-001 context). Adding Trigger.dev or BullMQ increases the operational surface area that must be monitored, maintained, and scaled for Tet surge (risk-matrix.md)
- Self-hosted worker rejected: contradicts the serverless architecture decision in ADR-001. There is no persistent process available on Vercel, and spinning up a separate hosting environment for workers defeats the monorepo single-deploy advantage (ADR-001)

---

### 2. Job Trigger Pattern -- Hybrid (`after()` for Latency-Sensitive + Cron for Sweeps)

| Option | Pros | Cons |
|--------|------|------|
| Pure cron polling (periodic sweep) | Simplest model; all jobs on fixed schedule; easy to reason about; no dual code paths | Minimum 1-minute resolution (Vercel Cron); notification delivery delayed by up to poll interval; OTP confirmation delayed unacceptably; booking confirmation at 60s boundary violates trust expectation |
| Event-driven via `after()` only | Zero-latency side effects; fires immediately after response; no cron infrastructure needed | `after()` is fire-and-forget -- if the serverless function crashes after response but during `after()`, the side effect is lost; no retry; no guaranteed delivery; not suitable for financial operations (payout settlement, ledger writes) |
| Message queue push | True event-driven; guaranteed delivery with retry; fan-out capability | Requires persistent consumer (not available on Vercel); additional infrastructure (ADR-001 context) |
| **Hybrid: `after()` for latency-sensitive + cron for sweeps/catch-up** | Immediate notification dispatch for OTP and booking confirmation (within 60s trust window); cron sweeps catch anything `after()` missed; financial operations (payout settlement) run exclusively via cron with full ACID guarantees; no infrastructure beyond Vercel Cron | Two trigger paths for some operations; must ensure idempotency so `after()` + cron don't double-process; slightly more complex mental model |

**Choice**: Hybrid (`after()` for latency-sensitive + cron for sweeps and catch-up)

**Reasons**:
- Receiving confirmation within 60 seconds separates trusted platforms from unreliable ones (market-research/user-insights.md). Pure cron with 1-minute resolution cannot guarantee sub-60-second notification delivery. `after()` fires immediately after the HTTP response, delivering booking confirmation SMS/ZNS within seconds
- OTP delivery is inherently blocking -- the user is actively waiting for the SMS. This cannot tolerate even 1 minute of cron delay. `after()` dispatches OTP SMS immediately after the verify response (telecom-sms.md, bounded-contexts.md)
- Financial operations (payout settlement, ledger writes) must NOT run via `after()` -- these require full ACID transactions with `SELECT FOR UPDATE` and idempotency guards, and must be auditable via `JobRunLog`. Cron-triggered execution provides the controlled, logged, retryable context these operations need (invariants-catalog.md, event-flows.md)
- All domains produce `NotificationLog` rows with `status='pending'`; the dispatch cron is the sole delivery path (bounded-contexts.md). The `after()` call is a best-effort accelerator -- the cron sweep is the guaranteed catch-up. If `after()` succeeds, the cron sweep finds nothing pending. If `after()` fails (cold-start crash, timeout), the cron sweep picks up the pending row on next invocation
- Idempotency is already built into every operation: `sourceEventId` unique constraint on LedgerEntry, `@@unique([adapter, providerTxnId])` on PaymentEvent, `completedAt IS NOT NULL` check for trip completion, `findFirst` dedup for payout creation (invariants-catalog.md). The hybrid pattern is safe because double-processing is a no-op

---

### 3. Concurrency & Consistency -- `FOR UPDATE SKIP LOCKED` Batch Processing

| Option | Pros | Cons |
|--------|------|------|
| Single-writer (only one instance runs at a time) | Simplest consistency model; no concurrent access issues | Single point of failure; if the single instance is slow, all jobs stall; cannot scale for Tet surge; Vercel Cron may invoke multiple instances if prior invocation is still running |
| Advisory locks (`pg_advisory_lock` per job type) | Prevents concurrent execution of same job type; PostgreSQL-native; already used for hold capacity guard | Blocks concurrent instances entirely -- second invocation waits or fails; doesn't help with batch parallelism; can cause connection-pool starvation if lock is held too long |
| **`FOR UPDATE SKIP LOCKED` batch processing** | Multiple concurrent cron invocations safely process different rows; no contention -- each instance skips rows already locked by another; battle-tested in hold expiry sweeper; PostgreSQL-native; scales naturally with Vercel auto-scaling during Tet surge; batch size (500) limits transaction duration | Requires careful batch sizing to avoid long transactions; slightly more complex SQL; each batch is a separate transaction (not one giant transaction) |
| Distributed lock (Redis-based, e.g., Redlock) | Works across processes; configurable TTL; Redis already available | Redis is an additional failure domain for job consistency; Redlock has known theoretical limitations; if Redis is down, all jobs stop; overkill when PostgreSQL provides `SKIP LOCKED` natively |

**Choice**: `FOR UPDATE SKIP LOCKED` batch processing

**Reasons**:
- Hold expiry already uses `UPDATE ... FOR UPDATE SKIP LOCKED` in batches of 500 -- this is a proven, production-validated pattern (invariants-catalog.md). Extending it to payout settlement, notification dispatch, and other sweepers maintains consistency across all background operations
- Vercel auto-scales serverless functions during Tet surge (10-20x volume, risk-matrix.md). If Vercel Cron triggers overlapping invocations (prior run still executing when next cron fires), `SKIP LOCKED` ensures the second invocation processes different rows -- no contention, no double-processing, no distributed lock needed
- PostgreSQL-native -- no additional infrastructure. The `SKIP LOCKED` behavior is part of the same database that holds the state being processed, eliminating the consistency gap between a lock service and the data store (ADR-001)
- Batch size of 500 rows per transaction limits transaction duration, preventing long-running transactions from blocking other database operations. Each batch commits independently -- if one batch fails, already-committed batches are not rolled back (invariants-catalog.md)
- Advisory locks rejected for sweepers: `pg_advisory_lock` blocks the connection until the lock is acquired, which can cause connection pool exhaustion under Vercel's limited connection budget via PgBouncer (ADR-001). `SKIP LOCKED` never blocks -- it skips and moves on
- Redis distributed lock rejected: adding Redis as a consistency mechanism for jobs introduces a failure mode where Redis downtime prevents ALL background jobs from running. The rate limiter already has a "fails open" risk (risk-matrix.md #13) -- adding job consistency to the same Redis dependency compounds this risk

---

### 4. Failure Handling & Retry -- At-Least-Once with Idempotency Guards

| Option | Pros | Cons |
|--------|------|------|
| At-most-once (fire and forget) | Simplest; no retry logic; no idempotency needed | Lost notifications (booking confirmation never sent = trust destruction); lost payout settlements (operator never paid = churn trigger #2); lost e-invoice submissions (GDT non-compliance per einvoice-tax.md) |
| **At-least-once with idempotency guards** | Retries ensure eventual delivery; idempotency guards (already built into every financial operation) prevent double-processing; `attemptCount` + `nextAttemptAt` on NotificationLog provides built-in retry with backoff; failed payout retried by admin (`retryPayout: failed -> requested`) | Must ensure every operation is idempotent (already true per invariants-catalog.md); retry storms possible if not rate-limited; slightly more complex than fire-and-forget |
| Exactly-once via transactional outbox | Strongest delivery guarantee; outbox pattern with CDC ensures no message loss | Requires Change Data Capture infrastructure (Debezium or equivalent); significant operational complexity; overkill for a platform with built-in idempotency on every financial operation; no persistent worker to consume outbox |

**Choice**: At-least-once with idempotency guards

**Reasons**:
- Every financial operation already has an idempotency mechanism built in: `sourceEventId` unique constraint on LedgerEntry, `@@unique([adapter, providerTxnId])` on PaymentEvent, `INSERT ... ON CONFLICT ("holdId") DO NOTHING` for booking creation, `completedAt IS NOT NULL` early return for trip completion, `findFirst` dedup for payout creation, double-probe `withdraw-key:<idempotencyKey>` for withdrawal (invariants-catalog.md). At-least-once delivery is safe because every receiver is idempotent
- NotificationLog already has `attemptCount` and `nextAttemptAt` for built-in retry with backoff. Failed notification dispatch increments the counter and pushes `nextAttemptAt` forward. The dispatch cron picks up rows where `nextAttemptAt <= NOW()` (bounded-contexts.md)
- Payout settlement failures transition to `status='failed'` with `failureReason`. Admin can retry via `retryPayout` (`failed -> requested`), which re-enters the settlement pipeline (state-machines.md, event-flows.md). This is a human-in-the-loop retry for the highest-stakes operation (money movement)
- At-most-once rejected: a lost booking confirmation SMS is a trust-destroying event. Lost payout settlement means operator doesn't get paid -- #2 churn trigger (competitor-benchmark/operator-sentiment.md). Lost e-invoice submission is GDT non-compliance (einvoice-tax.md)
- Transactional outbox rejected: requires CDC infrastructure (Debezium or equivalent) with a persistent consumer process. Vercel has no persistent process (ADR-001). The idempotency guards already built into every operation provide equivalent safety without the infrastructure overhead

---

### 5. Payout Settlement Pipeline -- Two-Phase (Mark Processing, Then Settle, Then Confirm)

| Option | Pros | Cons |
|--------|------|------|
| Synchronous batch (process all eligible in one sweep) | Simplest implementation; one cron invocation handles everything | Single PSP API failure blocks entire batch; long-running transaction holding locks across all payouts; if cron times out mid-batch, partial payouts with ambiguous state |
| Async per-payout fan-out (kick off individual PSP calls) | Each payout settles independently; one failure doesn't block others; natural parallelism | Requires fan-out mechanism (not available without queue); 300s Vercel function limit constrains parallelism; harder to track aggregate batch status |
| **Two-phase: mark `processing`, then settle per-payout, then confirm `paid`/`failed`** | Clear state at every step -- `requested -> processing -> paid/failed`; if cron crashes between phases, state is recoverable; `processing` status prevents double-settlement on next cron run; admin can see in-flight payouts; failed payouts retryable (`failed -> requested`) | Two DB round-trips per payout (mark + confirm); slightly more complex than single-pass; `processing` payouts must be cleaned up if abandoned |

**Choice**: Two-phase (mark processing, then settle, then confirm)

**Reasons**:
- The Payout state machine already defines this exact lifecycle: `requested -> processing -> paid | failed` (state-machines.md). The two-phase pattern is not an architectural choice but an implementation of the documented state machine
- Phase 1 (mark processing): cron sweep selects eligible payouts (`status='requested'`, `scheduledAt <= NOW()`) via `FOR UPDATE SKIP LOCKED`, transitions to `processing`. This immediately prevents the next cron invocation from re-selecting the same payouts -- no double-settlement risk
- Phase 2 (settle): for each `processing` payout, call PSP bank transfer API. On success, transition to `paid` with `settledAt`. On failure, transition to `failed` with `failureReason`. Each payout settles independently -- one PSP failure doesn't block others
- Failed payouts are retryable by admin via `retryPayout` (`failed -> requested`), re-entering the pipeline. This human-in-the-loop retry for money movement is appropriate for T+1 settlement reliability -- settlement speed is the #2 operator churn trigger (competitor-benchmark/operator-sentiment.md)
- Settlement delay enforced by `scheduledAt = completedAt + 1 day` (`SETTLEMENT_DELAY_DAYS = 1`). The cron WHERE clause `scheduledAt <= NOW()` naturally gates settlement timing. This ensures the 1-day buffer for dispute resolution and chargeback detection is honored (invariants-catalog.md, event-flows.md)
- Payout account verification gate (`PayoutAccount.verifiedAt IS NOT NULL`) must be re-verified at settlement time, not just at withdrawal request time. An operator editing account details between withdrawal request and settlement execution resets `verifiedAt` -- the settlement cron must check this and skip to `failed` if unverified (invariants-catalog.md)
- On-demand withdrawals create Payout rows with `scheduledAt = NOW()` and `tripId = null`. The same settlement sweep processes both auto-sweep (per-trip) and on-demand (operator-initiated) payouts through the same pipeline (event-flows.md)

---

### 6. Notification Delivery Strategy -- Cron Sweep of NotificationLog with `after()` Accelerator

| Option | Pros | Cons |
|--------|------|------|
| Inline via `after()` only | Zero latency -- fires immediately after response; simplest code path; no cron needed | Fire-and-forget -- if serverless function crashes during `after()`, notification is lost permanently; no retry; no delivery tracking; violates 60-second confirmation trust requirement if failure is silent |
| Dedicated notification worker | True queue consumer; guaranteed delivery; full retry control | Requires persistent process (not available on Vercel, ADR-001); separate hosting; separate deploy |
| **Cron sweep of NotificationLog with `after()` accelerator** | `after()` provides sub-second delivery for latency-sensitive notifications (OTP, booking confirmation); cron sweep (every 1 minute) catches anything `after()` missed; `attemptCount` + `nextAttemptAt` provides built-in retry with exponential backoff; full delivery audit trail in NotificationLog; dual-channel routing (Zalo ZNS primary, SMS fallback) decidable per notification | Two code paths for dispatch (after + cron); must ensure idempotency (status check before dispatch); cron resolution limits catch-up latency to 1 minute |

**Choice**: Cron sweep of NotificationLog with `after()` as best-effort accelerator

**Reasons**:
- All domains produce NotificationLog rows with `status='pending'`; the dispatch cron is the sole delivery path -- routes and webhooks only enqueue, never dispatch in-process (bounded-contexts.md). This architecture is already established -- the ADR codifies it
- Receiving confirmation within 60 seconds separates trusted platforms from unreliable ones (market-research/user-insights.md). The `after()` accelerator fires immediately after the HTTP response, dispatching booking confirmation SMS/ZNS within seconds. Without it, the minimum 1-minute cron resolution could delay confirmation past the 60-second trust threshold
- OTP delivery cannot tolerate any delay -- the user is actively waiting for the SMS. `after()` dispatches immediately. If `after()` fails silently (cold-start crash), the user can re-request OTP -- the send-OTP path supersedes prior active rows via `ON CONFLICT` (state-machines.md)
- Dual-channel routing (Zalo ZNS primary at ~200-500 VND/msg, SMS fallback at ~300-800 VND/msg) saves 50-70% on notification costs (telecom-sms.md). Channel selection logic lives in the dispatch function, not the enqueue path -- all producers create `NotificationLog` rows with template + recipient, and the dispatcher decides the channel
- Retry with exponential backoff: `attemptCount` tracks delivery attempts; `nextAttemptAt` pushes retry forward. Cron picks up rows where `status='pending' AND nextAttemptAt <= NOW()`. After max attempts, status transitions to `failed` for admin review
- eSMS downtime during Tet is an identified risk (stakeholder-map.md). The retry mechanism with `nextAttemptAt` backoff handles transient eSMS failures. Persistent failures surface in `JobRunLog` and the admin failure alert queue

---

## Job Catalog

The following jobs are identified from business documentation, grouped by trigger pattern:

### Cron-Triggered Sweepers

| Job | Schedule | Source | Behavior |
|-----|----------|--------|----------|
| `expireHolds` | Every 1 min | invariants-catalog.md, state-machines.md | `active` holds past `expiresAt` -> `expired` via `FOR UPDATE SKIP LOCKED` in batches of 500. Restores capacity for other customers. |
| `notificationDispatch` | Every 1 min | bounded-contexts.md, telecom-sms.md | Sweep `NotificationLog` rows with `status='pending' AND nextAttemptAt <= NOW()`. Dispatch via Zalo ZNS primary, SMS fallback, email tertiary. Retry with backoff on failure. |
| `settlePayout` | Every 5 min | state-machines.md, event-flows.md | Payout rows with `status='requested' AND scheduledAt <= NOW()` -> `processing` -> PSP bank transfer -> `paid`/`failed`. Two-phase pipeline. |
| `autoCompleteTrips` | Every 15 min | state-machines.md | Departed trips past expected completion window -> `completed`. Triggers payout row creation + `payout_scheduled` notification. |
| `charterExpirySweeper` | Every 15 min | state-machines.md, bounded-contexts.md | `PUBLISHED` charter requests past `claimByAt` -> `EXPIRED`. `ASSIGNED_DIRECT` past `acceptByAt` -> flag for admin re-routing. |
| `einvoiceSubmission` | Every 5 min | einvoice-tax.md, state-machines.md | `EInvoice` rows with `status='pending'` -> submit to MISA meInvoice API -> `issued`/`failed`. |
| `ticketPdfGeneration` | Every 5 min | event-flows.md | Paid bookings without `ticketPdfKey` -> generate PDF -> upload to object storage -> set `Booking.ticketPdfKey`. |
| `paymentReconSweeper` | Every 30 min | risk-matrix.md | Flag unmatched VietQR payments (memo truncation/mistype). Surface in admin reconciliation dashboard. |
| `generateFromTemplate` | Daily (early morning VN time) | ubiquitous-language.md, bounded-contexts.md | Auto-generate Trip rows from `RecurringTripTemplate` for 14-day rolling horizon. Dedup via partial unique index in `RecurringGenerationLog`. |
| `operatorLicenseAlert` | Daily | risk-matrix.md | Scan operator transport license expiry dates. Alert 60 days before expiry via admin notification. |
| `piiAnonymization` | Daily | regulatory/data-privacy.md, risk-matrix.md | Booking PII anonymization after 5-year retention period per PDPL 2025. |

### `after()`-Accelerated (with cron catch-up)

| Side Effect | Trigger Point | Source |
|-------------|---------------|--------|
| Booking confirmation SMS/ZNS | Payment webhook -> `applyPaidStatusTransition` | event-flows.md, market-research/user-insights.md |
| Operator new-booking notification | Payment webhook -> `applyPaidStatusTransition` | event-flows.md |
| OTP SMS dispatch | `/api/auth/otp/send` | bounded-contexts.md, telecom-sms.md |
| Trip cancellation SMS | `cancelTrip` -> NotificationLog per affected booking | event-flows.md |
| Operator status change SMS+email | `transitionOperatorStatus` | state-machines.md |
| Oversold/overpay refund | Payment webhook -> `refundOut` | event-flows.md, invariants-catalog.md |

---

## Consequences

### Positive
- Zero additional infrastructure beyond Vercel Cron + PostgreSQL -- operational simplicity for small team pre-launch, aligned with ADR-001 serverless architecture
- `FOR UPDATE SKIP LOCKED` batch processing scales naturally with Tet surge (10-20x volume) -- Vercel auto-scaling may trigger concurrent cron invocations, which safely process different rows without contention
- Hold expiry sweeper directly protects revenue -- abandoned holds no longer permanently reduce available capacity, addressing a business invariant rated as critical in the domain model (invariants-catalog.md)
- T+1 payout settlement sweep with two-phase state machine (`requested -> processing -> paid/failed`) provides full auditability and recoverability -- the exact lifecycle documented in state-machines.md
- `after()` accelerator ensures sub-60-second notification delivery for booking confirmation and OTP, meeting the trust threshold identified in user research (market-research/user-insights.md)
- Dual-channel notification routing (Zalo ZNS primary, SMS fallback) saves 50-70% on messaging costs compared to SMS-only (telecom-sms.md)
- All background operations inherit the existing idempotency framework -- no new idempotency patterns needed (invariants-catalog.md)
- E-invoice submission cron ensures Decree 70/2025 compliance (issue at payment time) without blocking the checkout flow (einvoice-tax.md)
- VietQR reconciliation sweeper addresses a risk rated HIGH likelihood x HIGH impact (risk-matrix.md)

### Negative
- 1-minute minimum cron resolution means the catch-up path for `after()` failures has up to 60 seconds of added latency -- a failed `after()` for booking confirmation could delay SMS by up to 1 minute plus dispatch time
- Vercel Cron has no built-in retry or dead-letter queue -- if a cron invocation crashes, the failed batch is only retried on the next scheduled invocation. A 1-minute cron with a crash means up to 2 minutes before retry
- 300-second Vercel function duration limit constrains batch size -- if payout settlement or notification dispatch processes more rows than can complete in 300s, the function times out and incomplete work must wait for next invocation
- No job queue dashboard -- monitoring relies on `JobRunLog` table queries and admin failure alerts, not a purpose-built UI like Bull Board or Inngest Dashboard
- Database-as-queue adds polling load to PostgreSQL -- every 1-minute notification sweep and hold expiry sweep is a query against the database, even when there is no work to do

### Mitigations
- `after()` failure latency: the 60-second catch-up latency is acceptable because the `after()` path succeeds in the vast majority of cases. Users can re-request OTP if the initial dispatch fails. Booking confirmation delay of 60-90 seconds (failed `after()` + next cron) is within the trust threshold (market-research/user-insights.md)
- Cron crash retry: each cron invocation logs to `JobRunLog` with start/end/count/errors. Admin failure alerts surface stalled jobs. For financial operations (payout settlement), the two-phase state machine ensures `processing` payouts are visible and recoverable (bounded-contexts.md, personas/admin-personas.md)
- 300s function timeout: batch sizes (500 for hold expiry, configurable for other sweepers) are tuned to complete well within the timeout. If volume exceeds batch capacity during Tet surge, the next cron invocation processes the overflow -- `SKIP LOCKED` ensures no contention (risk-matrix.md)
- No dashboard: Finance/Accounting Manager persona workflow includes payout queue and ledger reconciliation via the admin console (personas/admin-personas.md). `JobRunLog` data surfaces in the admin dashboard. Purpose-built job dashboard is a future enhancement when operational volume justifies it
- Polling load: `FOR UPDATE SKIP LOCKED` queries with proper indexes (e.g., `@@index([template, scheduledFor])` on NotificationLog, `@@index([status, scheduledAt])` on Payout) are index-scan queries that return immediately when no work exists. At pre-launch volume, this load is negligible. At Tet scale, PgBouncer connection pooling (ADR-001) manages connection pressure

---

## References

All decisions sourced exclusively from `documentation/business/`:

| Document | Cited In |
|----------|----------|
| invariants-catalog.md | D1, D2, D3, D4, D5, Job Catalog |
| state-machines.md | D2, D4, D5, D6, Job Catalog |
| event-flows.md | D2, D4, D5, Job Catalog |
| bounded-contexts.md | D1, D2, D4, D6, Job Catalog, Mitigations |
| ubiquitous-language.md | Context, Job Catalog |
| risk-matrix.md | D1, D3, Context, Job Catalog |
| market-research/user-insights.md | D2, D4, D6 |
| regulatory/telecom-sms.md | D2, D6, Job Catalog |
| regulatory/einvoice-tax.md | D4, Context, Job Catalog |
| regulatory/data-privacy.md | D1, Context, Job Catalog |
| regulatory/psp-contract-terms.md | Context |
| competitor-benchmark/pricing-comparison.md | Context, D5 |
| competitor-benchmark/operator-sentiment.md | D4, D5 |
| personas/admin-personas.md | D4, Mitigations |
| personas/operator-personas.md | Context |
| market-research/business-model.md | Context |
| market-research/strategic-roadmap.md | Context |
| investor-kpis.md | D1, Context |
| stakeholder-map.md | D6, Context |
| vietnam-market-context.md | Context |
