SECURITY-DEEP REVIEW — PR #301 "feat(ledger): migrate Payout to BigInt + Neon index readiness"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/301
Base/Head: master ← feat/payout-bigint-neon @ b4cd55f6
Decision:  (none — no review submitted in 10 days open)
Generated: 2026-07-26
Note:      First security-deep pass on this PR. The 2026-07-16 review set contained no
           security review; the pool change was seen only as a config nit.

Findings: 5  (P1: 1 · P2: 2 · P3: 2)


P1 — BLOCKING:

  lib/core/db/client.ts:14,23  🚫 P1: Threat-model delta — the pool change converts a
  known concurrency bug into an unauthenticated connection-exhaustion DoS, and widens the
  window ~16× in the same commit.

    Two values move together:
        max: 5 → 1                       (5× less parallelism per warm instance)
        connectionTimeoutMillis: 3s → 10s (3.3× longer before a queued acquire sheds)

    Against the code as it exists on master, that is not two config tweaks. It is the
    activation of open issue #362. lib/core/db/holdRepo.ts:97 takes a **blocking**
    `pg_advisory_xact_lock(hashtext('hold:' || tripId))` *inside* `prisma.$transaction` —
    and it takes it at step 1, after `tx.hold.count` has already opened the transaction.
    So the connection is held for the entire lock wait plus the entire conditional INSERT.

    At `max: 1` the warm instance has exactly one physical connection. Request A holds it
    and the trip lock. Request B cannot even reach the lock — it queues inside `pg.Pool`
    and, thanks to this PR, waits up to **10 seconds** instead of 3 before erroring. Every
    other route served by that instance — search, payment webhook, cron, operator console —
    queues behind the same single connection. The blast radius of one contended trip is the
    whole instance, not the hold path.

    Attacker economics: `POST /api/holds` requires no authentication (Phase 1 ships no
    customer auth — proxy.ts 410-gates the customer auth routes). One HTTP request costs
    the attacker nothing and costs the platform its entire DB capacity on that instance for
    the transaction's duration. Pick any popular trip; issue concurrent requests.

    The existing control does not bound this. proxy.ts:327 applies a per-IP
    `ratelimit.limit(ip)` sliding window — that caps requests **per unit time**. This
    attack is about **in-flight concurrency**, which a rate limiter does not measure: N
    simultaneous requests inside one window all pass. And the limiter is keyed on IP, so
    any rotating-source client bypasses it entirely.

    Pre-PR the same attack existed but degraded gracefully: 5 connections absorbed the
    fan-out, and a 3s timeout shed load fast. Post-PR: one connection, 10s hold. Roughly a
    16× regression in worst-case per-instance blocking, shipped as an undiscussed two-line
    change with no mention in the PR body.

    This is precisely why the PR is held. Recording it here so the security rationale is
    written down and not just folklore attached to #362.

    Fix (order matters, do not reorder):
      1. #362 — `pg_try_advisory_xact_lock` + bounded retry/backoff, so a contended trip
         fails fast instead of parking the connection.
      2. #363 — client.ts reads the validated config.
      3. Then #301. Justify `connectionTimeoutMillis: 10_000` on its own merits at that
         point; it is not implied by the pool-size decision and it is the half that turns
         a fast 503 into a hang.
      4. Independently of this PR: add a concurrency bound (in-flight semaphore or
         queue-depth cap) on the hold path. A rate limiter is the wrong instrument for a
         blocking-lock endpoint.


P2 — SHOULD FIX:

  lib/core/db/client.ts:23  ⚠️  P2: Pool starvation can breach the SePay webhook ack
  window — a money-path availability risk, not just a latency one.

    CLAUDE.md's 2026-07-21 SePay entry records the vendor contract verbatim: SePay counts
    a delivery successful only on **HTTP 200/201 within 30 seconds**; otherwise it marks
    the delivery failed and retries on Fibonacci backoff (7 attempts / 5 hours).

    `/api/payments/bank_transfer/webhook` is not in `RATELIMIT_EXEMPT` (proxy.ts:82 lists
    only the momo/zalopay/card/vnpay webhooks) and, like every other route, it draws from
    the same single connection. Under hold-lock contention the webhook now waits up to 10s
    at the pool before it even begins its own transaction. That is a third of SePay's
    budget consumed before any work starts, and it stacks with the webhook's own DB round
    trips. Sustained saturation can push a delivery past 30s.

    Consequence is not a slow page — it is a real bank transfer whose confirmation is
    deferred by hours, while `reconcilePayments` runs its own 15-minute sweep against a
    booking heading toward `payment_failed_expired`. The repo has already paid for this
    class of bug twice (#320, #322, #324).

    Fix: covered by the #362 → #363 → #301 ordering above. Separately, consider adding
    `/api/payments/bank_transfer/webhook` to `RATELIMIT_EXEMPT` — it is authenticated by
    the SePay API key and is the only PSP webhook currently subject to the per-IP limiter,
    which is an inconsistency with the four exempted siblings regardless of this PR.

  lib/jobs/processPayouts.ts:47  ⚠️  P2: Open issue #364 (unbounded claim) is untouched by
  this PR, and this PR makes its consequence materially worse.

    The claim query is:
        SELECT id, "operatorId", net FROM "Payout"
        WHERE status = 'requested' AND "scheduledAt" <= NOW()
        FOR UPDATE SKIP LOCKED
    No `LIMIT`. Its two siblings in lib/jobs/reconcilePayments.ts (lines 90 and 295) both
    cap at `CLAIM_LIMIT = 200`. This PR edits the `DuePayout` interface directly above the
    query (`net: number` → `net: bigint`) and leaves the missing LIMIT in place —
    neutral on its own terms.

    But the whole sweep runs in one transaction on what is now the instance's **only**
    connection, and it row-locks every due payout for the sweep's full duration. Today the
    exposure is small because `settlePayout` is a no-network stub. Its own header comment
    states the plan: *"When real bank HTTP lands, this is the call that must move outside
    the job transaction."* On that day, an unbounded row count × per-row bank HTTP × one
    connection is a total instance stall for the length of the sweep, plus row locks held
    across external I/O.

    Verdict on the #364 overlap: **left untouched, blast radius worsened.** #364 should be
    reclassified from P2 to a merge precondition for #301, or at minimum fixed in the same
    release. A `LIMIT 200` matching the reconcile sweeps is a one-line change.


P3 — ADVISORY:

  app/api/op/reports/payouts/[id]/retry/route.ts:36-45  ℹ️  P3: The BigInt serialization
  fix uses `{ ...p, <6 money fields>.toString() }`, spreading every column of the Prisma
  `Payout` row rather than an explicit field whitelist.

    `retryPayout` returns the full `Payout` (lib/ledger/retryPayout.ts:15 — `payout: Payout`
    from `tx.payout.update`), so the response carries `failureReason` (a raw settlement
    error string), `taxVat`/`taxPit`/`taxTotal`, `tripId`, `operatorId`, and both
    timestamps. Tenant-scoped — `retryPayout` guards on `operatorId`, so an operator sees
    only their own row, and the CI Data Leak Audit passes. Not a leak.

    It is a drift from CLAUDE.md's Issue 001 rule ("`select` whitelists = exactly the UI
    contract fields"). And the UI contract here is *empty*: the sole consumer,
    PayoutsClient.tsx `handleRetry`, calls `await retryPayoutApi(payoutId)` and discards
    the body entirely, then `router.refresh()`. The route returns 16 fields to satisfy zero
    of them. The pre-PR code had the same spread, so this is not a regression — but the PR
    rewrote this exact expression, which was the moment to narrow it.
    Fix: return `{ payout: { id, status } }`, or `{ ok: true }`.

  lib/core/db/holdRepo.ts:98  ℹ️  P3: `hashtext('hold:' || tripId)` collapses the lock key
  into a 32-bit int4 space. Two distinct trips whose keys collide serialize against each
  other for no reason. Harmless at current catalog size and not introduced by this PR, but
  it widens #362's contention surface beyond the trip actually under load, so it belongs in
  the #362 fix rather than after it.


CLEAN (scanned, no finding):

  Cat 1 — Crypto. No crypto primitive appears anywhere in the diff. No cipher, hash, KDF,
    IV, nonce, salt, token, or randomness construct added or modified.
  Cat 2 — Injection / SSRF / open redirect. No new user input reaches raw SQL, shell, HTML
    sink, `fetch` target, or redirect target. The one raw-SQL touch
    (e2e/op-reports.spec.ts:208) is a parameterised test fixture. No `eval`, `Function(`,
    `vm.runIn`, or string-interpolated `child_process`.
  Cat 3 — Rate limit. No new endpoint. No new auth/email/SMS/paid-resource path. (The
    concurrency-vs-rate gap is folded into the P1 above — it is a property of the existing
    limiter that this PR makes exploitable, not a missing limiter.)
  Cat 4 — Audit log. No new mutation handler under `app/api/admin/**` or `app/api/payment/**`,
    no role/permission/ownership-transfer path. The two admin payout handlers already emit
    `payout-approve` / `payout-retry` audit rows and are untouched.
  Cat 5 — Authz. No new handler; no sibling-authz divergence. The single modified route
    retains its `financeRoute` / operator-auth wrapper and `retryPayout`'s tenant guard.
  Cat 6 — PII. No new `console.log` / `logger.*` call. No new schema column of any kind —
    the migration only widens six existing integer columns and reshuffles indices. No
    logger redact-list update required.
  Secrets. gitleaks green; no literal key/token/password in the diff.


RECOMMENDED NEXT:
  - The P1 is a merge-ordering finding, not a code defect in this diff. Enforce
    #362 → #363 → #301 and do not let a green mergeStateStatus override it.
  - Reclassify #364 as a co-release precondition; the one-line `LIMIT 200` is cheap.
  - Re-run this review after the #362 rebase — the P1 downgrades substantially once the
    advisory lock is non-blocking.

SUMMARY: 1 P1 · 2 P2 · 2 P3 · pinned to b4cd55f6
