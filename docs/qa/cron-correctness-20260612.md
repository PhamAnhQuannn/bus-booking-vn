# Cron/Job Correctness Audit
Date: 2026-06-12
Scope: 11 cron handlers, 11 job cores (+2 infrastructure modules), advisory lock infrastructure

## Summary

All 11 cron handlers share the same failing-open CRON_SECRET pattern (a known P1 already flagged by security-review-full; not re-reported here). Advisory lock key uniqueness is verified — all 11 keys are distinct. Most jobs are well-implemented with proper batching, SKIP LOCKED concurrency control, and idempotency guards. Three new correctness issues are found: `autoCloseSales` and `autoCompleteTrips` run unbounded queries without a LIMIT, `sendReminders` performs SMS I/O (currently stubbed) inside the advisory lock transaction, and `processPayouts` performs settlement inside the same transaction. Two route handlers (`reconcile-payments` and `retention`) have no dedicated route-level unit tests.

---

## CRON_SECRET Pattern Audit

| Handler | Pattern | Vulnerable? | Notes |
|---|---|---|---|
| sweep-holds | `if (cronSecret && authHeader !== ...)` | YES | Fails open when `CRON_SECRET` env unset |
| close-sales | `if (cronSecret && authHeader !== ...)` | YES | Identical pattern |
| complete-trips | `if (cronSecret && authHeader !== ...)` | YES | Identical pattern |
| dispatch-notifications | `if (cronSecret && authHeader !== ...)` | YES | Identical pattern |
| generate-ticket-pdfs | `if (cronSecret && authHeader !== ...)` | YES | Identical pattern |
| generate-trips | `if (cronSecret && authHeader !== ...)` | YES | Identical pattern |
| process-payouts | `if (cronSecret && authHeader !== ...)` | YES | Identical pattern |
| reconcile-payments | `if (cronSecret && authHeader !== ...)` | YES | Identical pattern |
| retention | `if (cronSecret && authHeader !== ...)` | YES | Identical pattern |
| send-reminders | `if (cronSecret && authHeader !== ...)` | YES | Identical pattern |
| charter-expiry | `if (cronSecret && authHeader !== ...)` | YES | Identical pattern |

**Pattern is identical across all 11 handlers.** The fix (`if (!cronSecret || authHeader !== ...)`) has been documented in security-review-full as P1 and is not re-reported here.

The route tests for sweep-holds explicitly assert that when `CRON_SECRET` is unset, access is allowed (`'allows access when CRON_SECRET is not set'`) — this test will need to be updated once the fix ships.

---

## Schedule Analysis

| Job | Schedule | Appropriate? | Overlap Risk | Lock Protects? |
|---|---|---|---|---|
| sweep-holds | `* * * * *` (every 1 min) | Yes — holds expire on a short TTL | High (1-min interval, BATCH_LIMIT 500 may take >1 min under load) | YES — `hold-expiry` advisory key |
| close-sales | `* * * * *` (every 1 min) | Yes — departure-time precision matters | High (1-min interval, **no LIMIT** — full table scan on departure) | YES — `sales-close` advisory key |
| complete-trips | `*/5 * * * *` (every 5 min) | Yes — 5-min granularity is fine for T+1 payouts | Low-medium (**no LIMIT** — could be slow on large fleets) | YES — `trip-complete` advisory key |
| send-reminders | `*/15 * * * *` (every 15 min) | Yes — 15-min window is fine for a 23–25h target | Low | YES — `reminder-24h` advisory key |
| process-payouts | `0 * * * *` (hourly) | Yes — T+1 payouts don't need sub-hour precision | Low | YES — `payout-processor` advisory key |
| dispatch-notifications | `* * * * *` (every 1 min) | Yes — notification latency target is near-realtime | High (1-min, bounded by dispatcher's own LIMIT) | YES — `notify-dispatch` advisory key |
| generate-ticket-pdfs | `*/2 * * * *` (every 2 min) | Yes — BATCH_SIZE 25 per tick is modest | Low-medium | YES — `ticket-pdf` advisory key |
| charter-expiry | `0 * * * *` (hourly) | Yes — charter deadlines are hour-granularity | Low | YES — `charter-sweep` advisory key |
| retention | `0 3 * * *` (daily at 03:00) | Yes — retention is a daily batch | Negligible | YES — `retention-sweep` advisory key |
| reconcile-payments | `*/15 * * * *` (every 15 min) | Yes — CLAIM_LIMIT 200 per tick | Low-medium | YES — `reconcile-payments` advisory key |
| generate-trips | `0 1 * * *` (daily at 01:00) | Yes — 14-day horizon, daily is sufficient | Negligible | YES — `trip-generate` advisory key |

---

## P1 — Correctness Bugs

### P1-1: `autoCloseSales` — unbounded UPDATE, no LIMIT
**File:** `lib/jobs/autoCloseSales.ts:14-27`

The UPDATE query has no `LIMIT` clause. In production with many routes, this executes a full-table scan + bulk UPDATE touching all due trips in a single statement. Under normal load this is fine, but if a clock drift or prior outage causes a large backlog of un-closed trips, the single statement can take many seconds while holding the advisory lock — blocking the next cron tick from running and potentially causing a PG statement timeout if `statement_timeout` is configured.

**Impact:** Advisor lock held indefinitely during large batch; potential timeout cascade.

**Fix:** Adopt the same `WITH due AS (SELECT id FROM "Trip" WHERE ... LIMIT 500 FOR UPDATE SKIP LOCKED) UPDATE "Trip" SET ... WHERE id IN (SELECT id FROM due) RETURNING id` CTE pattern used by `expireHolds`.

---

### P1-2: `autoCompleteTrips` — unbounded SELECT FOR UPDATE, no LIMIT
**File:** `lib/jobs/autoCompleteTrips.ts:22-31`

The claim query selects ALL departed-past-duration trips with no LIMIT. Then the loop calls `completeTripCore` for each — each of which does multiple DB operations (SELECT FOR UPDATE, UPDATE trip, SELECT bookings, createMany notifications, findFirst + create payout). For N trips this is N × ~5 round-trips inside the advisory lock transaction.

At a 5-minute cron interval, if 50+ trips complete simultaneously (e.g. after a deployment outage), this transaction could run for many seconds, holding the advisory lock across the entire duration and keeping the DB connection occupied.

**Impact:** Lock held for O(N) time, no bound on N. Risk of Vercel function timeout (default 10s on Hobby, 30s on Pro) for large batches.

**Fix:** Add `LIMIT 50` to the claim query (aligned with Vercel function timeout budget). The SKIP LOCKED already handles concurrency; subsequent cron ticks pick up the remainder.

---

### P1-3: `sendReminders` — network I/O inside advisory lock transaction (latent)
**File:** `lib/jobs/sendReminders.ts:70-74` and `lib/jobs/withAdvisoryLock.ts:41`

`sendReminders` calls `sendSms(...)` inside the `prisma.$transaction` callback that holds the advisory lock. `withAdvisoryLock` comments acknowledge this:

> "V1 note: sendSms is a no-network stub … so the call is safe inside the job transaction. When real eSMS HTTP lands this must move to claim-then-dispatch."

The comment exists in `withAdvisoryLock.ts` as a V1 note but there is no enforcement mechanism (no TODO ticket reference, no lint rule). When `sendSms` transitions from stub to real HTTP:
- An HTTP call inside a DB transaction holds the PG connection for the full HTTP round-trip (up to seconds under eSMS latency).
- This blocks all other queries on that connection while the network call is in flight.
- Under the advisory lock, this means no concurrent cron tick for `reminder-24h` can run at all during that HTTP call.
- If eSMS is slow or down (e.g. 30s timeout), the PG transaction sits open for 30s per booking in the batch.

**Impact:** Latent P1 — currently safe (stub) but will become a reliability hazard the moment real eSMS is enabled. Could cause DB connection pool exhaustion.

**Fix (claim-then-dispatch pattern):**
1. Within the tx: `UPDATE Booking SET reminderSentAt = now() WHERE id = ... AND reminderSentAt IS NULL` (claim only — the idempotency stamp).
2. COMMIT the tx (advisory lock released).
3. After commit: call `sendSms(...)` and write the `NotificationLog` row on the pooled client (outside any transaction).

The same applies to `processPayouts` (calls `settlePayout` inside the tx) — already noted in `withAdvisoryLock.ts`'s V1 comment but the V1 stub is safe today.

---

## P2 — Reliability Risks

### P2-1: `sweep-holds` count-mode doesn't use `runJob` — no JobRunLog audit trail
**File:** `app/api/cron/sweep-holds/route.ts:34-45`

In `count` mode (default — `HOLD_SWEEPER_MODE` not set to `update`), the handler queries the DB directly and returns without calling `runJob`. No `JobRunLog` row is written for count-mode runs. Given that count mode is the default, most production invocations produce no audit trail in `JobRunLog`.

**Impact:** Operational blind spot — can't tell from `JobRunLog` whether the cron ran at all if `HOLD_SWEEPER_MODE` stays at the default.

**Fix:** Either document that count-mode is a read-only probe (intentional, acceptable), or switch default to `update` mode and log count-mode runs with a lightweight log entry. The current code does call `logger.info` but not `JobRunLog`.

---

### P2-2: `generateTicketPdfs` throughput under burst load
**File:** `lib/jobs/generateTicketPdfs.ts:31` (`BATCH_SIZE = 25`)

With `BATCH_SIZE = 25` at a 2-minute interval, throughput is ~750 PDFs/hour. If 1,000 bookings arrive at once (e.g. after a popular route goes on sale), the queue clears in ~80 minutes. During that window, customers waiting for their ticket email see an 80-minute delay.

**Impact:** Acceptable for current scale; becomes a SLA issue at >5,000 bookings/burst.

**Recommendation:** Document the throughput ceiling in the job comment. Consider increasing `BATCH_SIZE` to 50-100 once PDF render performance is profiled.

---

### P2-3: `charterExpirySweeper` — two separate claim queries, two LIMIT windows
**File:** `lib/jobs/charterExpirySweeper.ts:75-93`

The sweeper issues two separate `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 200` queries (one for `ASSIGNED_DIRECT`, one for `PUBLISHED`). If there are 300 stale `ASSIGNED_DIRECT` rows and 300 stale `PUBLISHED` rows, only 200 of each are processed per tick. This is correct (bounded by design), but the overall backlog clearing rate is 400/tick rather than the 200/tick a single combined query would imply.

**Impact:** Minor — double the throughput is actually better. No correctness issue.

**Note:** The two-step `PUBLISHED → EXPIRED → ADMIN_REVIEW` transition for a row that loses the race at the `EXPIRED` step would leave the row in `EXPIRED` state permanently because the `illegal_transition` catch only fires at the `EXPIRED` transition, and the `ADMIN_REVIEW` transition is only attempted after. If `EXPIRED → ADMIN_REVIEW` fails with a non-`illegal_transition` error, the row is stranded in `EXPIRED`. This is acceptable since `EXPIRED` is documented as a transient state that only the sweeper creates, but it's worth a comment.

---

### P2-4: `reconcilePayments` — `Number()` coercion on `totalVnd`
**File:** `lib/jobs/reconcilePayments.ts:130-131` (`amount = Number(parsed.amount ?? 0)`)

The `recoverEvent` function parses `amount` from the stored IPN rawBody using `Number(parsed.amount ?? 0)`. For VND amounts up to ~10^9 (a full-bus premium route), `Number` is safe (below 2^53). However, the Mistake Log (Issue 016) established that VND currency math must stay in BigInt domain to avoid representation drift in multiplication. Here the comparison is `ev.amount >= totalVnd` (integer comparison, no multiplication), so `Number` is tolerable — but it diverges from the project convention.

**Note:** The code-review-full audit already flagged `Number()` coercion in `reconcilePayments.ts` as P1. This entry confirms that `recoverEvent`'s `Number(parsed.amount ?? 0)` is a separate (non-multiplication) use; it should still be addressed for consistency.

---

### P2-5: `retentionSweeper` — storage failure stops KYB purge mid-batch
**File:** `lib/jobs/retentionSweeper.ts:110-112`

When `deleteObject` throws (e.g. S3 not implemented), the error propagates out of the `for` loop and the entire `retentionSweeper` call throws. The advisory lock transaction rolls back, which means:
- Any `kybDocument.update` (purgedAt stamp) calls for rows processed BEFORE the failure are also rolled back (they're on the same `tx`).
- The batch is effectively idempotent — on the next run, the same rows are reclaimed and attempted again.

This is actually correct behavior (loud failure, no silent partial purge). The unit test asserts this explicitly. No bug here — documented for completeness.

---

## P3 — Advisory

### P3-1: `withAdvisoryLock` does not forward `opts` to the core
**File:** `lib/jobs/withAdvisoryLock.ts:41` — `return core(tx);` (not `core(tx, opts)`)

`withAdvisoryLock` drops opts entirely. Six cores (`autoCompleteTrips`, `processPayouts`, `charterExpirySweeper`, `retentionSweeper`, `generateTicketPdfs`, `reconcilePayments`) read `opts?.now` for clock injection. In production this has no effect because none of these cores are called through `runJob` with opts (they all default to `new Date()` in the function body). Tests that call cores directly (not through `runJob`) pass opts explicitly to the core, bypassing `withAdvisoryLock`.

**Impact:** None in production. If a future caller passes opts to `runJob`, the clock injection would be silently dropped.

**Fix:** Add `opts?: JobOpts` parameter to `withAdvisoryLock` signature and pass it through: `return core(tx, opts)`. Low risk, minor cleanup.

---

### P3-2: `autoCloseSales` — no per-row error isolation
**File:** `lib/jobs/autoCloseSales.ts:14-27`

`autoCloseSales` uses a single bulk UPDATE (no loop), so there's no per-row error isolation. If the UPDATE fails (e.g. constraint violation on some row), the entire batch rolls back. This is the correct behavior for a bulk UPDATE — the query either succeeds or fails atomically. No action needed; noted for completeness.

---

### P3-3: `sendReminders` — only selects `paid` bookings, not `completed`
**File:** `lib/jobs/sendReminders.ts:54` — `WHERE b.status IN ('paid'::"BookingStatus")`

The reminder query only matches bookings with `status = 'paid'`. Bookings in `status = 'completed'` (e.g. post-trip completion) would not receive a 24h reminder if they somehow had `reminderSentAt IS NULL`. In practice, a trip departs before completion, so a booking moves to `completed` after departure — the 23–25h window would have already elapsed. No correctness issue; the status filter is safe.

---

### P3-4: `dispatchNotifications` ignores the lock `tx`
**File:** `lib/jobs/dispatchNotifications.ts:14-15`

The job wrapper comment explicitly documents that the inner core "deliberately ignores the lock tx for its claim/dispatch work (its own short transactions commit independently on the pooled prisma client)." The advisory lock exists only to serialize ticks, not to hold writes on the lock connection. This is correct and intentional; documented for completeness.

---

## Job-by-Job Analysis

### sweep-holds
- **Status:** Functional. Count mode is default; update mode is opt-in via env.
- **Correctness:** BATCH_LIMIT 500, FOR UPDATE SKIP LOCKED — correct.
- **Edge cases:** Empty result set is handled (0 rows updated → rowsAffected: 0).
- **Idempotency:** Yes — only flips `active` holds with `expiresAt < NOW()`.
- **Race conditions:** SKIP LOCKED prevents double-expiry. No interaction with `close-sales` (different tables/columns).
- **Test coverage:** Route unit tests: YES (`sweep-holds/__tests__/route.test.ts`). Job core integration tests: YES (`cronJobs.int.test.ts` AC1).

### close-sales
- **Status:** Functional but missing LIMIT (P1-1 above).
- **Correctness:** Sets `salesClosed = true` only on `status = 'scheduled'` trips at/after departure. Correct — departed/completed/cancelled trips are excluded.
- **Edge cases:** Empty result set → 0 rows returned, rowsAffected: 0. Correct.
- **Idempotency:** Yes — `WHERE salesClosed = false` ensures each trip is closed exactly once.
- **Race conditions:** `expireHolds` and `close-sales` touch different tables (Hold vs Trip). No race between them.
- **Test coverage:** Route unit tests: YES. Job core integration tests: YES (`cronJobs.int.test.ts` AC2).

### complete-trips
- **Status:** Functional but unbounded claim query (P1-2 above).
- **Correctness:** Correct — only `departed` trips past `departureAt + durationMinutes` are selected.
- **Edge cases:** `completeTripCore` handles `alreadyCompleted` idempotency. A trip with zero paid bookings still completes and creates a zero-gross Payout. The `departedAt` guard mentioned as a known issue (code-review-full P1) exists in `completeTripCore` — the cron path does NOT check `departedAt IS NOT NULL`; it relies on the `status = 'departed'` check instead. The operator-initiated `markDeparted` sets `status = 'departed'`; `autoCompleteTrips` only selects `status = 'departed'` trips. This is correct as long as `departedAt` is always set when transitioning to `departed`. Verify `markDeparted` always sets `departedAt`.
- **Idempotency:** `completeTripCore` checks `completedAt IS NOT NULL` for idempotency.
- **Test coverage:** Route unit tests: YES. Job core integration tests: YES (`cronJobs.int.test.ts` AC3).

### dispatch-notifications
- **Status:** Functional. Wrapper around the notification dispatcher core.
- **Correctness:** Advisory lock serializes ticks; inner dispatcher uses its own per-row locking. Lock tx is NOT used for writes — correct (documented design).
- **Edge cases:** Inner dispatcher has its own LIMIT/SKIP LOCKED; empty result is a no-op.
- **Test coverage:** Route unit tests: YES (`dispatch-notifications/__tests__/route.test.ts`). Core unit tests: covered by notification dispatcher's own tests.

### generate-ticket-pdfs
- **Status:** Functional. BATCH_SIZE = 25 per tick at 2-minute interval.
- **Correctness:** Claim → render → upload → stamp → enqueue pattern is correct. `FOR UPDATE SKIP LOCKED` on claim, `WHERE ticketPdfKey IS NULL` guard on stamp prevent double-generation. Render/upload happens OUTSIDE the claim transaction (lock not held during PDF rendering).
- **Edge cases:** `buyerEmail IS NULL` → email not enqueued, PDF still generated. Correct. Row deleted between claim and findUnique → `continue` (correct).
- **Idempotency:** Yes — stamp guard `WHERE ticketPdfKey IS NULL` on `updateMany` is belt-and-suspenders.
- **Throughput:** ~750 PDFs/hour (see P2-2).
- **Test coverage:** Route unit tests: YES. Core unit tests: YES (`generateTicketPdfs.test.ts`). Integration tests: NO.

### generate-trips
- **Status:** Functional. Per-row idempotency via `(recurringTemplateId, departureAt)` partial unique.
- **Correctness:** Advisory lock + per-row guard → correct.
- **Edge cases:** No active templates → 0 rows generated. Correct.
- **Idempotency:** YES — per-row unique constraint is the definitive guard.
- **Test coverage:** Route unit tests: YES. Job core integration tests: YES (`cronJobs.int.test.ts` I43). Idempotency test: YES.

### process-payouts
- **Status:** Functional. Skips unverified payout accounts (Issue 078).
- **Correctness:** Correct — `scheduledAt <= NOW()` gate, `FOR UPDATE SKIP LOCKED`, `requested → processing → paid/failed` transitions all in one tx.
- **Edge cases:** Zero due payouts → loop doesn't execute, rowsAffected: 0. Correct. Ledger debit for on-demand withdrawals handled via check-then-append (Issue 053).
- **Idempotency:** `sourceEventId` unique key on `payout_debit` ledger entries prevents double-debit.
- **Latent risk:** `settlePayout` runs inside the advisory lock tx (see P1-3). Currently a stub; needs claim-then-dispatch when real bank HTTP lands.
- **Test coverage:** Route unit tests: YES. Job core integration tests: YES (`cronJobs.int.test.ts` AC5, including idempotency test).

### reconcile-payments
- **Status:** Functional. CLAIM_LIMIT 200, `FOR NO KEY UPDATE SKIP LOCKED`.
- **Correctness:** Three branches (confirming, degraded match, expire) are all implemented correctly. Monotonic guard prevents regression. `after()` is used for oversold refund ledger entries post-commit.
- **Edge cases:** Empty candidates → only one `$queryRaw` issued. Hold still active → skipped (not expired). Underpaid success → treated as no-payment. Correct.
- **Idempotency:** Monotonic UPDATE guard on `applyPaidStatusTransition`, unique(bookingId, template) on notification enqueue.
- **Test coverage:** Route unit tests: NO (no `reconcile-payments/__tests__/route.test.ts`). Core unit tests: YES (`reconcilePayments.test.ts`). Core integration tests: YES (`reconcilePayments.int.test.ts`).

### retention
- **Status:** Functional. Two-phase (bulk guest scrub + per-row KYB purge).
- **Correctness:** Guest scrub is idempotent via `snapshotAnonymizedAt IS NULL`. KYB purge uses FOR UPDATE SKIP LOCKED + KYB_CLAIM_LIMIT 200. Loud failure on `deleteObject` (no silent stamp without deletion).
- **Edge cases:** Nothing past the window → 0/0. Correct. ACTIVE operators excluded (status gate: REJECTED/SUSPENDED only).
- **Idempotency:** Guest scrub: `snapshotAnonymizedAt IS NULL` predicate. KYB: `purgedAt IS NULL` predicate.
- **Safeguards:** Only scrubs guest bookings (`customerId IS NULL`). Only purges docs for REJECTED/SUSPENDED operators. Money/audit columns untouched.
- **Test coverage:** Route unit tests: NO (no `retention/__tests__/route.test.ts`). Core unit tests: YES (`retentionSweeper.test.ts`). Core integration tests: YES (`retentionSweeper.int.test.ts`).

### send-reminders
- **Status:** Functional for stub SMS. Latent P1 for real SMS (P1-3).
- **Correctness:** `FOR UPDATE OF b SKIP LOCKED` on Booking. `reminderSentAt IS NULL` guard fires exactly once. 23–25h window is correct for a 24h-reminder.
- **Edge cases:** No eligible bookings → 0 rows, no SMS sent. Correct.
- **Idempotency:** `reminderSentAt IS NULL` guard. Second run for same booking returns 0 rows.
- **Unbounded query:** No LIMIT on the claim query. Low risk at current scale (few hundred bookings in the 23–25h window at any given time), but should be bounded as a defensive measure.
- **Test coverage:** Route unit tests: YES. Job core integration tests: YES (`cronJobs.int.test.ts` AC4).

### charter-expiry
- **Status:** Functional. Two-class claim (ASSIGNED_DIRECT + PUBLISHED), two-step transition for PUBLISHED.
- **Correctness:** `illegal_transition` errors are caught per-row and the sweep continues. Correct.
- **Edge cases:** Concurrent operator action wins the race → `illegal_transition` caught, row skipped. PUBLISHED→EXPIRED→ADMIN_REVIEW: if EXPIRED step throws `illegal_transition`, the ADMIN_REVIEW step is never reached (correct). If EXPIRED step succeeds but ADMIN_REVIEW step throws a non-`illegal_transition` error, the row is stranded in EXPIRED state. No test for this scenario.
- **Idempotency:** `illegal_transition` on re-run after a completed reroute means the already-done row is skipped.
- **Test coverage:** Route unit tests: YES. Core unit tests: YES (`charterExpirySweeper.test.ts`). Integration tests: NO.

---

## Test Coverage

| Job | Route unit test | Core unit test | Core integration test |
|---|---|---|---|
| sweep-holds | YES | — (core is trivial SQL) | YES (cronJobs.int.test.ts AC1) |
| close-sales | YES | — (core is trivial SQL) | YES (cronJobs.int.test.ts AC2) |
| complete-trips | YES | — (delegates to completeTripCore) | YES (cronJobs.int.test.ts AC3) |
| dispatch-notifications | YES | (notification dispatcher's own tests) | (notification dispatcher's own tests) |
| generate-ticket-pdfs | YES | YES (generateTicketPdfs.test.ts) | NO |
| generate-trips | YES | — (delegates to generateTripsFromTemplates) | YES (cronJobs.int.test.ts I43) |
| process-payouts | YES | — (tested via integration) | YES (cronJobs.int.test.ts AC5) |
| reconcile-payments | **NO** | YES (reconcilePayments.test.ts) | YES (reconcilePayments.int.test.ts) |
| retention | **NO** | YES (retentionSweeper.test.ts) | YES (retentionSweeper.int.test.ts) |
| send-reminders | YES | — (tested via integration) | YES (cronJobs.int.test.ts AC4) |
| charter-expiry | YES | YES (charterExpirySweeper.test.ts) | NO |

**Missing route-level tests:** `reconcile-payments` and `retention` have no `__tests__/route.test.ts` files. These should be added to verify CRON_SECRET auth behaviour at the route layer (the pattern is identical to the other 9 routes, so coverage is low-risk but the gap is notable).

---

## Advisory Lock Analysis

### Key uniqueness
All 11 lock keys are distinct:

| Key | Job |
|---|---|
| `hold-expiry` | sweep-holds (update mode) |
| `sales-close` | close-sales |
| `trip-complete` | complete-trips |
| `notify-dispatch` | dispatch-notifications |
| `ticket-pdf` | generate-ticket-pdfs |
| `trip-generate` | generate-trips |
| `payout-processor` | process-payouts |
| `reconcile-payments` | reconcile-payments |
| `retention-sweep` | retention |
| `reminder-24h` | send-reminders |
| `charter-sweep` | charter-expiry |

No hash collisions confirmed (distinct string names; `hashtext()` collisions are theoretically possible but negligible with 11 inputs).

### Lock mechanism
`pg_try_advisory_xact_lock(hashtext(jobName))` is transaction-scoped — the lock auto-releases at COMMIT or ROLLBACK. No manual unlock needed. Correct under Prisma connection pooling.

### Timeout / overlap behavior
If a job runs longer than its schedule interval (e.g., `sweep-holds` at 1-minute interval takes >60s), the next cron tick fires, finds the lock held, and returns `{ status: 'skipped_locked', rowsAffected: 0 }`. A `JobRunLog` row is written for the skip. This is correct behavior.

### Error handling
On core throw: the advisory lock transaction rolls back (lock released). `runJob` catches the error, writes `status: 'failed'` to `JobRunLog` (outside the lock tx, on the pooled client — persists even on tx rollback), then rethrows. The cron route catches and returns HTTP 500. Lock is always released on error.

### opts not forwarded
`withAdvisoryLock` calls `core(tx)` without `opts`. Six cores read `opts?.now` for clock injection, defaulting to `new Date()`. This is harmless in production (no opts are passed through `runJob`), but means the `opts` param on `JobCore` type cannot be used end-to-end in production. See P3-1.

---

## Recommendations

**Immediate (before production launch):**

1. **(P1-1) Add LIMIT to `autoCloseSales`** — adopt the CTE+RETURNING pattern from `expireHolds`. Suggested limit: 500. File: `lib/jobs/autoCloseSales.ts`.

2. **(P1-2) Add LIMIT to `autoCompleteTrips` claim query** — add `LIMIT 50` or similar to the `SELECT FOR UPDATE` before the per-trip loop. File: `lib/jobs/autoCompleteTrips.ts:22-31`.

3. **(P1-3) Document the claim-then-dispatch migration path for `sendReminders` and `processPayouts` with a linked issue number** — currently just a V1 note in comments. Create an issue before enabling real eSMS/bank HTTP.

**Short-term:**

4. **(P2-1) Decide on count-mode audit strategy** — either document that count-mode is intentionally unlogged, or switch the default to `update` mode. File: `app/api/cron/sweep-holds/route.ts`.

5. **(P2-2) Profile and tune `BATCH_SIZE` for `generateTicketPdfs`** — current 25/2min gives ~750/hour. Benchmark at BATCH_SIZE=50.

6. **Add route-level unit tests for `reconcile-payments` and `retention`** — copy the pattern from `sweep-holds/__tests__/route.test.ts` (auth tests + runJob mock).

7. **(P3-1) Forward `opts` through `withAdvisoryLock`** — trivial one-line fix that makes the clock-injection contract usable end-to-end. File: `lib/jobs/withAdvisoryLock.ts:41`.

**Operational:**

8. **Add a LIMIT to `sendReminders` claim query** — defensive measure. Current scale is low risk but the pattern is inconsistent with other batched jobs.

9. **Monitor `JobRunLog` for `skipped_locked` patterns** — repeated skips at short-interval jobs (sweep-holds, close-sales, dispatch-notifications) are a leading indicator that query time has grown past the cron interval.
