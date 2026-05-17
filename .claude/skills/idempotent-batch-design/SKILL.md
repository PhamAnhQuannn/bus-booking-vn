---
name: idempotent-batch-design
description: Batch / bulk job design that survives partial completion, replay, and concurrent worker takeover. Idempotency-key strategy per row + checkpoint progress + at-least-once delivery to downstream sinks with exactly-once effective semantics. Outputs `docs/design/idempotent-batch-<job>.md`. Use when user says "batch job", "bulk import", "nightly job", "ETL", "backfill", "reprocess", "replay-safe", "/idempotent-batch-design", or before any job that touches money, sends messages at scale, or mutates external systems in bulk. Reads `/project-classify`; skip XS+S.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 6h
---

# /idempotent-batch-design — Replay-safe Batch Job Design

## Why you'd care

Batch jobs that aren't idempotent leave you with two bad options when a worker dies mid-run: re-run and double-process, or skip and lose data. Designing for at-least-once delivery with exactly-once effect is the only stable path.

> **Why you'd care:** Naive batch jobs are the #1 cause of double-charges, duplicate notifications, and "we re-ran the nightly and it sent 500k emails again". A correctly designed idempotent batch is replayable any number of times with the same effective result — making backfills, partial-failure recovery, and concurrent-worker takeover routine instead of incident-grade events.

Invoke as `/idempotent-batch-design`. Required for: payment batch settlements, scheduled notification fanouts, ETL pipelines that write to externally-visible systems, data backfills, periodic reconciliations, mass-update admin jobs, daily ledger close jobs.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP (unless the batch touches money or sends mass messages).
2. Read `docs/design/idempotency-key-design-<project>.md` (per-request idempotency key strategy; batch reuses + extends).
3. Read `docs/design/saga-<project>.md` if the batch is part of a saga (e.g., compensation batch).
4. Read `docs/design/observability-<project>.md` (we'll hook trace + alert per run).
5. Read `docs/ops/backup-restore.md` if the batch is data-mutating (rollback path requires backups).

## Inputs
- Batch name + business purpose (settle yesterday's payments / send digest / refresh balances / reconcile vendor data).
- Input source: DB query, S3/GCS bucket of files, Kafka topic offset range, vendor API export, queue snapshot.
- Output sinks: DB writes, vendor API calls, message queue, email/SMS, webhook fan-out, file generation.
- Volume: rows/run, rows/sec target, max-tolerable duration.
- SLA: hard deadline (e.g., settle before 5pm bank-cutoff) or soft (eventual).
- Failure tolerance: zero-loss (must process every row eventually) vs best-effort.
- Frequency: scheduled (cron/queue), event-triggered, manual replay.

## Process

1. **Decide the unit of work**:
   - Per-row processing (1 row = 1 unit; simplest replay; required for money/notifications)
   - Per-chunk processing (N rows = 1 unit; faster but harder partial-replay; only OK if downstream supports bulk-idempotent)
   - **Default: per-row.** Always go per-row unless throughput math demands chunks and downstream sink accepts bulk-idempotency keys (Stripe BatchAPI, BigQuery streaming, S3 multipart).

2. **Derive a stable, deterministic idempotency key per row**:
   - **Natural key form**: `<batch_name>:<input_source>:<row_pk>:<input_version>`
     - Example: `settle_payments:2026-05-12:payment_id=pi_xyz:v1`
   - **Synthetic key fallback** (when no natural pk): `<batch_run_id>:<row_hash>` where `row_hash = sha256(canonical(row))`.
   - **Replay vs new run**: if rerunning a specific date partition, key MUST be identical to first attempt (no random uuid in key, no timestamp-of-attempt).
   - **Version bump**: if input changes between runs (a payment was retroactively adjusted), bump `input_version` so it's treated as a new row.
   - Store the idempotency key alongside every downstream call's request log.

3. **Design the progress-state table** — the source of truth for "which rows are done":
   ```sql
   CREATE TABLE batch_run (
     id              uuid PRIMARY KEY,
     batch_name      text NOT NULL,
     input_partition text NOT NULL,      -- e.g. '2026-05-12'
     state           text NOT NULL,      -- pending|running|completed|failed|cancelled
     started_at      timestamptz,
     completed_at    timestamptz,
     total_rows      int,
     processed_rows  int NOT NULL DEFAULT 0,
     failed_rows     int NOT NULL DEFAULT 0,
     worker_id       text,
     lease_until     timestamptz,        -- for worker takeover
     UNIQUE (batch_name, input_partition)  -- one logical run per partition
   );
   CREATE TABLE batch_row (
     run_id          uuid NOT NULL REFERENCES batch_run(id),
     row_key         text NOT NULL,      -- natural key from step 2
     idempotency_key text NOT NULL,      -- full per-row idempotency key
     state           text NOT NULL,      -- pending|in_progress|done|failed|skipped
     attempt         int NOT NULL DEFAULT 0,
     input_hash      bytea NOT NULL,
     last_error      text,
     started_at      timestamptz,
     finished_at     timestamptz,
     response        jsonb,
     PRIMARY KEY (run_id, row_key)
   );
   CREATE INDEX batch_row_pending ON batch_row(run_id, state) WHERE state IN ('pending','in_progress');
   ```
   - **UNIQUE (batch_name, input_partition)** prevents accidental parallel runs of the same logical work.
   - **batch_row.state machine**: `pending → in_progress → (done | failed)`. `failed → in_progress` on retry. `done` is terminal.

4. **Define the row lifecycle**:
   ```
   1. SELECT row_key FROM batch_row WHERE run_id=? AND state='pending' LIMIT N FOR UPDATE SKIP LOCKED
   2. UPDATE batch_row SET state='in_progress', started_at=now(), attempt=attempt+1 WHERE row_key=ANY(?)
   3. for each row:
       3a. process row (call vendor / write DB) WITH idempotency_key
       3b. on success: UPDATE batch_row SET state='done', response=?, finished_at=now()
       3c. on retryable err: UPDATE batch_row SET state='pending', last_error=?  (with backoff bookkeeping)
       3d. on fatal err: UPDATE batch_row SET state='failed', last_error=?
   ```
   - `FOR UPDATE SKIP LOCKED` allows multiple workers to take disjoint rows without contention.
   - `state='in_progress'` + `lease_until` lets a stuck row be reclaimed.

5. **Worker lease + takeover (concurrent workers / pod restart)**:
   - On row claim, set `lease_until = now() + 5 min` (tune to slowest per-row vendor call).
   - Sweeper job every 60s: `UPDATE batch_row SET state='pending' WHERE state='in_progress' AND lease_until < now()`.
   - Workers self-heartbeat: every 60s extend lease for rows still in flight.
   - **Crash safe**: any worker death frees its rows within `lease_until` time; another worker resumes; idempotency key ensures no double-effect.

6. **Backpressure + rate limiting**:
   - Downstream RPS budget: e.g., Stripe 100 req/s for write API; SES 14 msg/s default; SendGrid 10k/s; vendor API spec.
   - Token-bucket per worker, shared via Redis `INCR` + expiry; or in-process if single-worker.
   - On 429: exp backoff respecting `Retry-After` header; do NOT mark row failed; mark in_progress with lease extension.
   - Concurrency cap: `MAX_INFLIGHT` per worker × `WORKER_COUNT` ≤ downstream budget × 0.7 (30% headroom).

7. **Atomic side-effect + state update**:
   - **Hard requirement**: the side-effect (vendor call OR DB write) and the `state='done'` marker must be observationally atomic from the consumer's perspective.
   - **Patterns**:
     - **DB-only batch**: side-effect + state update in same transaction. Trivially atomic.
     - **Vendor-call batch**: 2-step protocol —
       1. Call vendor with idempotency key.
       2. Persist response + flip state in DB transaction.
       3. If the process crashes between (1) and (2), on retry the vendor call returns the SAME response for the same idempotency key, and we re-record it. Net effect: exactly-once-effective.
     - **Multi-sink batch**: nest in a saga (`/saga-orchestrator-design`) — each sink is a step with its own per-row idempotency key.

8. **Failure classification + retry policy**:
   - **Transient (retryable)**: 5xx, 408, 429, ECONNRESET, ETIMEDOUT, vendor "service unavailable". → Mark pending, backoff exp 1s→2s→4s→8s→16s→32s, max 8 attempts. After max, mark failed-pending-review.
   - **Permanent (non-retryable)**: 4xx (validation), 403 (auth — fail entire batch), 422 (bad row data). → Mark failed; do not retry without operator action.
   - **Poison row**: > 8 retryable attempts → quarantine: `state='failed'`, alert on-call, allow operator to force-skip or fix data and reset.
   - **Whole-batch abort triggers**: > 5% failure rate, > 100 failed rows in 10 min, downstream credential rejected (401/403). Page on-call; freeze further processing.

9. **Checkpointing + resume semantics**:
   - State is in `batch_row` rows; no in-memory progress to lose.
   - On restart, worker picks up `state='pending'` rows for any open run.
   - **Cold-start resume** (after multi-hour outage): query open `batch_run`s (`state='running'` with stale `started_at`), continue without re-enqueuing duplicates.
   - **Replay a completed run**: insert a new `batch_run` row with same `(batch_name, input_partition)` BLOCKED by unique constraint. To force replay: explicit `DELETE FROM batch_run WHERE id=?` (admin-gated, 2-person approval).

10. **Observability per run**:
    - **Metrics** (prometheus / datadog): `batch_run_started`, `batch_run_completed`, `batch_run_duration_seconds`, `batch_row_processed_total`, `batch_row_failed_total`, `batch_row_retried_total`, `batch_in_progress_gauge`, `batch_throughput_rps`, `batch_p95_row_latency_ms`.
    - **Traces**: span per row; trace per run; vendor call as child span with idempotency key as attribute.
    - **Logs**: structured `{run_id, row_key, idempotency_key, attempt, outcome, duration_ms, vendor_response_id}`.
    - **Alerts**:
      - `batch_failure_rate > 1%` for 5 min → warn
      - `batch_failure_rate > 5%` for 1 min → page
      - `batch_run_duration > SLA × 1.5` → page
      - `batch_stuck_rows > 0 in_progress for > 2 × lease` → page
      - `batch_run not started by scheduled_time + 10 min` → page

11. **Reconciliation (post-batch verify)**:
    - Source-vs-sink count check: `SELECT count(*) FROM batch_row WHERE state='done'` ≟ source count. If not, escalate.
    - Sample N rows: pull idempotency key from log, query vendor, assert response matches stored response.
    - Daily ledger close: assert `sum(batch_row.amount where state='done') = sum(source.amount)` (see `/ledger-invariants` for invariants).

12. **Operator runbook (mandatory)**:
    - **How to start a manual run**: CLI/admin endpoint, partition + batch_name, requires confirmation.
    - **How to pause**: set `batch_run.state='paused'`; workers skip claiming new rows; in-flight rows finish.
    - **How to cancel**: set `state='cancelled'`; workers free leases without retrying.
    - **How to replay failed rows only**: `UPDATE batch_row SET state='pending', attempt=0 WHERE run_id=? AND state='failed'`.
    - **How to replay full run**: requires deleting existing run record + 2-person approval; warns about double-effect risk despite idempotency (some downstream sinks have 24h idempotency-key TTL).
    - **How to investigate a stuck row**: query `batch_row WHERE state='in_progress' AND lease_until < now()`, examine `last_error` + tracing.

## Output
Write `docs/design/idempotent-batch-<job>.md`:

```markdown
# Idempotent Batch — <job_name>
**Date:** <YYYY-MM-DD>
**Owner:** <team>
**Frequency:** <cron / on-demand / event-triggered>

## Purpose + contract
- **Business purpose**: <e.g., settle yesterday's pending payments via Stripe Transfers>
- **Trigger**: cron `0 2 * * *` (2am UTC daily) + manual replay button
- **Input**: SELECT FROM payments WHERE state='captured' AND captured_at::date = $partition_date
- **Outputs**: Stripe Transfer per row + Ledger journal entry per row + Slack notification per merchant
- **SLA**: complete by 5am UTC (3-hour budget)
- **Volume**: ~50k rows/run growing to 500k/run by Y2
- **Failure tolerance**: zero-loss; every row must eventually process

## Unit of work
- Per-row; one Stripe Transfer + one journal entry per row
- Stripe accepts per-call idempotency key; aligns perfectly

## Idempotency key
- `settle_payments:<partition_date>:payment_id=<pi_xxx>:v1`
- `input_version` bumped if payment is adjusted retroactively
- Stored in `batch_row.idempotency_key` AND passed to Stripe as `Idempotency-Key` header

## Schema
```sql
CREATE TABLE batch_run (
  id              uuid PRIMARY KEY,
  batch_name      text NOT NULL,
  input_partition text NOT NULL,
  state           text NOT NULL,
  started_at      timestamptz,
  completed_at    timestamptz,
  total_rows      int,
  processed_rows  int NOT NULL DEFAULT 0,
  failed_rows     int NOT NULL DEFAULT 0,
  worker_id       text,
  lease_until     timestamptz,
  UNIQUE (batch_name, input_partition)
);
CREATE TABLE batch_row (
  run_id          uuid NOT NULL REFERENCES batch_run(id),
  row_key         text NOT NULL,
  idempotency_key text NOT NULL,
  state           text NOT NULL,
  attempt         int NOT NULL DEFAULT 0,
  input_hash      bytea NOT NULL,
  last_error      text,
  started_at      timestamptz,
  finished_at     timestamptz,
  response        jsonb,
  PRIMARY KEY (run_id, row_key)
);
CREATE INDEX batch_row_pending ON batch_row(run_id, state) WHERE state IN ('pending','in_progress');
```

## State machine
**Run**: `pending → running → (completed | failed | cancelled | paused)`
**Row**: `pending → in_progress → (done | failed)` ; `failed → pending` on retry

## Worker behavior
```
loop:
  claim_rows = SELECT row_key FROM batch_row
               WHERE run_id=? AND state='pending'
               LIMIT 100 FOR UPDATE SKIP LOCKED
  for each row in claim_rows:
    set state=in_progress, lease_until=now()+5min, attempt+=1
    try:
      response = stripe.transfers.create(amount, idempotency_key)
      ledger.journal(amount, payment_id, response.id)  # txn
      set state=done, response=response, finished_at=now()
    on transient err: set state=pending, last_error=err
    on permanent err: set state=failed, last_error=err
heartbeat every 60s: extend lease_until for in-flight rows
sweeper every 60s: reclaim stale leases (state=in_progress AND lease_until<now → state=pending)
```

## Concurrency + rate limit
- Workers: 4 pods × 10 concurrent rows = 40 inflight
- Stripe budget: 100 req/s; we cap at 70 req/s shared via Redis token bucket
- Backpressure: on 429, exp backoff respecting Retry-After

## Failure policy
| Class | Trigger | Action |
|---|---|---|
| Transient | 5xx, 408, 429, network | exp backoff 1-2-4-8-16-32s, max 8 attempts |
| Permanent | 4xx validation, 422 | mark failed, no auto retry |
| Auth-fatal | 401/403 | freeze run, page on-call |
| Poison | >8 retries | quarantine, page on-call |
| Whole-batch | >5% failure for 5 min | freeze, page |

## Observability
- Metrics: `batch_run_duration_seconds`, `batch_row_processed_total{state}`, `batch_throughput_rps`, `batch_p95_row_latency_ms`, `batch_stuck_rows`
- Trace: per-run trace; per-row span; Stripe call child span with idempotency_key attribute
- Log: `{run_id, row_key, idempotency_key, attempt, outcome, duration_ms, stripe_transfer_id}`
- Dashboards: Datadog `Settlement Batch`
- Alerts:
  - failure_rate > 1% / 5 min → warn
  - failure_rate > 5% / 1 min → page
  - duration > 4.5 hr → page
  - not_started_by 02:10 UTC → page
  - stuck_rows > 0 in_progress > 10 min → page

## Reconciliation
- Post-run: `count(state=done) == total_rows`. If not, alert.
- Daily ledger close: `sum(stripe transfer amounts) == sum(payments captured)` per partition.
- Weekly sample: pick 50 rows, fetch Stripe transfer by `response.id`, assert amount+currency+destination match.

## Operator runbook
- **Start manual run**: `POST /admin/batches/run` with `{batch_name, partition_date}` ; requires admin role
- **Pause**: `UPDATE batch_run SET state='paused' WHERE id=?` — workers stop claiming; in-flight finish
- **Cancel**: `UPDATE batch_run SET state='cancelled' WHERE id=?` — workers release leases without finishing
- **Replay failed rows only**: `UPDATE batch_row SET state='pending', attempt=0 WHERE run_id=? AND state='failed'`
- **Replay whole run**: 2-person approval ; `DELETE FROM batch_run WHERE id=?` ; re-enqueue. CAUTION: Stripe idempotency-key TTL is 24h — replay after 24h may create duplicate transfers.
- **Investigate stuck row**: trace by `row_key`, examine `last_error`, check Stripe dashboard for the idempotency_key

## Test plan
- **Unit**: idempotency key generation deterministic + collision-free.
- **Integration**: run batch on staging fixture; assert row count, side-effect count, journal sum.
- **Chaos**: kill worker mid-row; verify another worker resumes within 5 min and produces no duplicate.
- **Replay**: run batch twice on same partition; assert second run produces 0 new Stripe transfers (idempotency-key hit).
- **Backfill drill**: run last 30 partitions in parallel; assert no double-effect on overlapping rows (none should overlap by partition design).
- **Poison row**: inject row that always 422s; verify quarantine + alert + zero whole-batch impact.
- **Rate-limit**: ramp to 2× downstream budget; verify backoff smooths to budget without errors.

## Sign-off
- Design approved: <name>, <date>
- Runbook tabletop: <date>
- Production go-live: <date>
```

## Verification
- Per-row idempotency key deterministic across replays.
- `batch_row` state machine + lease + sweeper documented.
- Failure-class policy explicit (transient / permanent / poison / whole-batch).
- Atomic side-effect + state-update pattern stated (in-txn or 2-step with idempotency-key).
- Reconciliation step compares source vs sink counts + amounts.
- Operator runbook covers pause/cancel/replay-failed/replay-all with safety gates.
- Alerts include duration, failure rate, stuck rows, and not-started-by-deadline.
