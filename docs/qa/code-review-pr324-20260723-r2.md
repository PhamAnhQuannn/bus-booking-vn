CODE REVIEW (ROUND 2) — PR #324 "fix(payments): reconcile sweeper could not recover ANY bank transfer (Bug B)" @ 320b7dc0
────────────────────────────────
Diff scope (vs master): 16 files, +941 / -76 lines
Round-2 delta (0435fe1..320b7dc): 5 files, +176 / -98 — one commit,
  `320b7dc fix(payments): never auto-pay a booking from a guessed payment match`
Base: master · Head: fix/bank-transfer-reconcile-orphan · Mode: PR (read-only)
Reviewed: 2026-07-23 · Round-1 report: docs/qa/code-review-pr324-20260723.md @ 0435fe17

Scope note: line-level only. `/verify` assumed green; I re-ran
`pnpm vitest run lib/jobs/__tests__/reconcilePayments.test.ts` → 13/13 pass.


─────────────────────────────────────────────────────────────────────────
ROUND-1 FINDINGS — DISPOSITION
─────────────────────────────────────────────────────────────────────────

  P1  receiving account never validated (bankTransfer.ts:93)
      → CHANGED SEVERITY: P1 → P2. No longer a money-movement path (nothing
        auto-pays), but the input is still unread and now feeds the suspicion
        signal and the orphan record. Detail under P2 below.

  P2  sweeper↔webhook ABBA deadlock
      → RESOLVED. The claim `$executeRaw` is gone; grep of reconcilePayments.ts
        shows the only write to PaymentEvent removed, and the file's remaining
        `$executeRaw` is the Booking expire UPDATE (line 466). The sweeper is now
        a pure reader of PaymentEvent, so it cannot form the cycle. The header
        CONCURRENCY block was updated to state this (lines 49-51) — good, that
        was the fallback ask.

  P2  orphan rows outside every retention / anonymisation path
      → STILL OPEN, unchanged. `Select-String PaymentEvent` over
        lib/jobs/retentionSweeper.ts and lib/account/anonymizeCustomer.ts returns
        zero hits at HEAD. Worse in round 2, see P2 below: orphans now also
        accumulate as permanent *suspicion* evidence, so the "must not be
        auto-deleted" note in the migration is now doubly binding and there is
        still no redaction arm.

  P2  `bookingId IS NULL AND receivedAt BETWEEN` unindexed
      → RESOLVED. New SQL-only migration
        `20260723180000_payment_event_orphan_receivedat_idx`. Verified below.

  P2  no test asserts the FALSE side of `adapter === 'bank_transfer'` scoping
      → STILL OPEN, severity down to P3. Round 2 touched only the reconcile
        tests; `app/api/payments/momo/webhook/__tests__/route.test.ts` is
        unchanged since round 1. Deleting the `adapter ===` clause still leaves
        every suite green — but the blast radius is now "unbounded orphan rows +
        spurious holds on MoMo bookings", not a credit. Reclassified P3.

  P3  claimed orphan + `updated === 0` → silent burn
      → RESOLVED by deletion (no claim exists).
  P3  `matchDegraded` "(or cross-linked)" dead condition
      → STILL OPEN (reconcilePayments.ts:186, and the docstring is now stale in a
        second way — see P3 below).
  P3  stale rawBody/currency on the webhook-side claim (processWebhook.ts:232)
      → STILL OPEN (webhook claim untouched by round 2 — correctly so, it is a
        different mechanism from the deleted sweeper claim).
  P3  `recordUnmatchedPaymentEvent` "NEVER throws" contract unasserted
      → STILL OPEN.
  P3  int fixture derives body `id` from a digit-free string → both bodies `id:1`
      → STILL OPEN.
  P3  `verifyWebhook` runs twice per delivery
      → STILL OPEN.
  P3  all seven MoMo fakeTx mocks hardcode `updateMany → {count:0}`
      → STILL OPEN.


─────────────────────────────────────────────────────────────────────────
ROUND-2 DELTA — VERIFIED CORRECT
─────────────────────────────────────────────────────────────────────────

  ✔ The suspicion branch is positioned correctly and cannot intercept a real
    payment. `if (confirming) { … continue; }` (lines 311-413) has NO fall-through
    path: the `refundTriggered` arm `continue`s at 347, and the block's own
    `continue` at 412 is unconditional — reached even when `updated === 0`. So
    line 415 is only reachable with `confirming === null`. A linked confirming
    event still pays through the unchanged (a) branch; the delta did not touch
    lines 311-413 at all.

  ✔ `const confirming` (line 309) is genuinely never reassigned — the only two
    former assignment sites (`let confirming = …`, `confirming = degradedMatch`)
    were both deleted. TypeScript narrows it to `null` at line 430, so the control
    flow is exactly what the comments claim.

  ✔ The new `continue` (line 442) skips nothing that matters. Everything after it
    is the expire path: `holdExpired` computation → guarded UPDATE → expiry notice
    → `expiredCount += 1`. No counter, notification, or ledger write is bypassed,
    and the `rowsAffected = paidCount + expiredCount` contract at line 495 still
    matches its docblock at line 69. (A held booking contributes 0 — which is a
    finding, see P1, not a contract break.)

  ✔ The partial index predicate matches the live query. The scan is
    `pe."bookingId" = $1 OR (pe."bookingId" IS NULL AND pe."receivedAt" BETWEEN …)`
    (lines 282-293); the second OR arm carries `bookingId IS NULL` as a literal
    conjunct, so Postgres can prove the partial predicate for that arm and
    BitmapOr it with `PaymentEvent_bookingId_idx` for the first. Correct column,
    correct predicate, correct direction (no ORDER BY to satisfy).

  ✔ SQL-only placement is right and matches the repo rule. `git diff master...HEAD
    -- prisma/schema.prisma` shows the PaymentEvent block gains no `@@index` for
    `receivedAt` — only the nullable `bookingId` + explicit `onDelete: Restrict`
    from round 1. Prisma's DSL cannot express `WHERE`, so this is the Issue 007
    "partial indices stay SQL-only" case exactly, and the migration comment cites
    the (now-corrected) `migrate diff` invocation as evidence of no drift.

  ✔ Migration ordering is safe: 20260723120000 drops NOT NULL, 20260723180000
    builds the partial index. Building it on the still-empty table avoids a later
    `CREATE INDEX CONCURRENTLY` — the comment says so and is correct.

  ✔ The inverted integration test genuinely fails if auto-pay returns.
    `expect(early?.status).toBe('awaiting_payment')` / `toBe('awaiting_payment')`
    for BOTH bookings, `credits.length === 0`, `orphan?.bookingId` null — every
    one of those flips under any re-introduced pay-the-guess rule, whichever
    booking it picked. The round-1 version ("exactly one credit") could not: it
    was satisfied BY the defect. This is a real upgrade, and the CLAUDE.md entry
    naming the "exactly one is a consistency property, not a safety property"
    lesson is accurate.

  ✔ The unit assertions are strong in the right places: `mockApplyPaid` not
    called, `mockAppendLedger` not called, `tx.$executeRaw` **not called at all**
    (which pins BOTH "no claim" and "no expire" in one assertion), zero
    notification rows, `rowsAffected: 0`, and the warn log asserted by
    `paymentEventId` + `providerTxnId`.

  ✔ The new control test ("still expires when NO orphan fits",
    reconcilePayments.test.ts) does guard against the suspicion branch swallowing
    every expiry: same bank_transfer booking, lapsed hold, orphan present but at
    `GROSS + 1`, asserting `$executeRaw` called exactly once and
    `rowsAffected: 1`. It exercises the amount predicate specifically; the
    adapter and window predicates are covered by the separate
    `matchDegraded rejects wrong amount / wrong account / outside window` unit
    test, so the three-predicate surface is collectively pinned.

  ✔ Held bookings do NOT leak seat inventory. `holdRepo.ts:132-146` counts
    `awaiting_payment` toward capacity only within `PSP_WINDOW_MINUTES = 20`, and
    `getTripOccupancy.ts:12-14` excludes it entirely. A booking held for weeks
    therefore never blocks a seat. This was my main worry about "hold forever" and
    it is clean.

  ✔ Underpaid / wrong-currency (branch (c)) rows still expire: those events are
    LINKED, and `matchDegraded` skips `ev.bookingId === booking.id` at line 202,
    so they can never become a suspicion. Issue 032 semantics preserved.


─────────────────────────────────────────────────────────────────────────
PRIORITY 1 — Block merge, fix first
─────────────────────────────────────────────────────────────────────────

  [FAILURE MODE / PAYMENT — the new HOLD state has no drain and no surface]
  lib/jobs/reconcilePayments.ts:415-444

    Round 2 replaced an automated (wrong) resolution with a manual one. The manual
    one does not exist. A booking that trips the suspicion branch enters a state
    that nothing in the codebase can leave, that nobody is told about, and that
    nothing bounds.

    Nothing drains it.
      `payment_failed_expired` is written in exactly one place —
      reconcilePayments.ts:466 (grep of `payment_failed_expired` across lib/ shows
      no other job writes it). A suspected booking `continue`s past that UPDATE
      every tick, forever. It stays `awaiting_payment`, stays above threshold,
      stays in the candidate set. There is no marker column, no status, no TTL, no
      second sweeper.

    Nobody sees it.
      - `listOperatorBookings.ts:33,83` filters `status: { in: PAID_STATUSES }`
        (paid, completed) — the operator queue cannot show it.
      - No admin bookings view exists (`grep awaiting_payment app/` returns only
        customer-facing pages and cron/test files).
      - `logger.warn` has no Sentry/alert hook (`grep captureMessage lib/logger.ts`
        → no matches); only `captureException` on error paths is routed.
      - `JobRunLog` (schema.prisma:468-479) has columns
        `status / rowsAffected / errorMessage` and nothing else, and
        `rowsAffected = paidCount + expiredCount` excludes held rows. A tick that
        holds 40 bookings and does nothing else persists
        `status='success', rowsAffected=0` — indistinguishable from an idle tick.
      The entire safety property of this PR rests on a human tailing logs for
      `reconcile.unmatched_payment_suspected`.

    The customer is never told.
      The expire branch enqueues `customerBookingExpired`. The hold branch
      enqueues nothing. `BankTransferClient.tsx:117-131` just renders the expired
      countdown and keeps polling a status that will never change. A customer
      whose money DID arrive now gets silence indefinitely — previously they at
      least got a (wrong) expiry SMS that would prompt them to complain, which was
      the de-facto detection channel.

    It is unbounded by construction, and false positives are expected, not rare.
      The index migration's own comment states it: "SePay notifies on EVERY credit
      to the receiving account, not only ticket payments, and the adapter's gate
      before recording an unmatched row is just `transferType = 'in'` + positive
      amount. Ordinary business deposits therefore accumulate as orphans." Any
      such deposit that happens to equal a stuck booking's exact fare within ±30
      min of its hold pins that booking permanently — and fares are round numbers.
      Every pin is permanent, so the population is monotonic with no drain.

    Which lands on the starvation you asked me to check — it is real.
      The candidate query (lines 257-261) is
      `WHERE status='awaiting_payment' AND createdAt < threshold ORDER BY
       createdAt ASC LIMIT 200`. Held bookings are by definition the OLDEST
      qualifying rows and they never leave the set, so they occupy the front of
      that ordering permanently. `SKIP LOCKED` does not help — nothing else locks
      them. Degradation is linear from the first held row and total at 200:
      once 200 permanently-held bookings exist, the sweeper does nothing but
      re-log them, and NO newer booking is ever paid or expired again — silently,
      with `status: 'success'`. The payment safety net dies without a single error.
      Secondary cost meanwhile: each held row re-runs the orphan window query
      every tick, and re-emits its warn line 96×/day (log spam that also buries
      the genuinely new suspicions among the permanent ones).

    Fix (minimum to merge — a marker solves all four at once):
      1. Persist the suspicion instead of only logging it. Cheapest shape that
         fits this schema: a nullable `Booking.paymentReviewAt DateTime?` (or a
         `NotificationLog`-style row) set on first detection.
      2. Exclude already-marked rows from the candidate query
         (`AND "paymentReviewAt" IS NULL`) — kills the starvation AND the per-tick
         log spam in one predicate, and makes the warn fire exactly once.
      3. Count them: return them in the log summary and either add a
         `heldCount` to the job's log line or fold into `rowsAffected` with the
         docblock at line 69 updated. A tick that holds work must not report 0.
      4. Give the human a list. An op/admin filter on the marker is the real fix;
         if the deploy is time-boxed, a documented SQL query in the runbook plus
         an alert on `reconcile.unmatched_payment_suspected` is an acceptable
         interim, but it must be written down before merge, not after.
      5. Decide and document the customer story — either an SMS ("we're checking
         your transfer") or an explicit "no message by design, ops calls them".
         Silence-by-omission is the current state and is not a decision.

    To be explicit: this is NOT a regression against master or against round 1.
    Round 2 is strictly safer than both. It is P1 because the PR's stated safety
    argument ("Resolution is manual", line 49) depends on machinery that does not
    exist, and because the starvation path silently disables the sweeper.


─────────────────────────────────────────────────────────────────────────
PRIORITY 2 — Fix before merge
─────────────────────────────────────────────────────────────────────────

  [SECURITY / INPUT VALIDATION — receiving account still never validated]
  lib/payment/adapters/bankTransfer.ts:30-31, :93   (was round-1 P1)

    `payload.accountNumber` and `payload.subAccount` are still declared on
    `SepayWebhookPayload` and still read nowhere. `const unmatched = {
    providerTxnId: String(payload.id) }` is populated for any inbound credit on
    any SePay-connected account.

    The P1 exploit IS dead: with no auto-pay and no CAS claim, an unvalidated
    orphan can no longer move money, credit a ledger, or fire a paid SMS. Round 2
    removed the exploitable sink, not the gap. What remains:
      - Transfers into an unrelated connected account are persisted as orphan
        PaymentEvents carrying payer name (`content`), `accountNumber`, `gateway`,
        `referenceCode` — see the PII finding below.
      - Those foreign-account orphans are exactly the false-suspicion fuel for the
        P1 above: they can pin an innocent booking that should have expired, at
        the cost of nothing to whoever sent them.
      - `reconcile.unmatched_payment_suspected` then tells a human "money probably
        arrived for this booking" about money that may have landed somewhere else
        entirely — actively misleading the manual process this PR now depends on.

    Fix (unchanged from round 1, cheaper now): gate `unmatched` on
    `payload.accountNumber === getEnv().VIETQR_ACCOUNT_NUMBER`
    (lib/config/env.ts:123, prod-required and default-rejected at env.ts:407-412),
    decide the `subAccount` policy explicitly in a comment, cite the SePay payload
    doc URL at the check site per the 2026-07-21 Mistake Log rule, and add the
    negative unit test: valid inbound transfer, foreign accountNumber → `ok:false`
    with `unmatched` UNDEFINED.

  [PII / RETENTION — orphan rows still outside every cleanup path]
  prisma/schema.prisma:418, lib/payment/processWebhook.ts:110   (round-1, open)

    Re-verified at HEAD: `retentionSweeper.ts` and `anonymizeCustomer.ts` contain
    no reference to PaymentEvent, and an orphan is unreachable through the
    `booking` relation filter every other cleanup uses (the int suites still need
    their delete-by-`providerTxnId` pass to avoid leaking into the shared DB —
    reconcilePayments.int.test.ts:297-301).

    Round 2 raises the stakes rather than lowering them: orphans are now the sole
    persistent evidence behind the suspicion holds, so "delete them" is not
    available, and the migration comment correctly forbids auto-deletion. That
    makes a *redaction* arm the only compatible answer.

    Fix: add an orphan arm to `retentionSweeper` that nulls/redacts `rawBody`
    (keeping `providerTxnId`, `receivedAt`, amount) on
    `PaymentEvent WHERE "bookingId" IS NULL AND "receivedAt" < now() - <policy>`,
    with the window well beyond `DEGRADED_MATCH_WINDOW_MINUTES` and long enough
    for bank-statement triage. Route the window through
    `lib/account/retentionPolicy.ts`, not a literal. The new partial index makes
    this arm cheap.


─────────────────────────────────────────────────────────────────────────
PRIORITY 3 — Address when convenient
─────────────────────────────────────────────────────────────────────────

  [READABILITY / DEAD CONDITION] lib/jobs/reconcilePayments.ts:430
    `if (!confirming)` is unconditionally true at that point — the `if (confirming)`
    block above always `continue`s (412), and TS narrows `confirming` to `null`
    here. As written it implies the branch could be reached with a confirmation,
    which is the one thing the comment above it insists cannot happen.
    Fix: drop the wrapper (`const suspected = matchDegraded(…); if (suspected) {…}`)
    so the comment and the code say the same thing.

  [DOC DRIFT] lib/jobs/reconcilePayments.ts:183-190
    `matchDegraded`'s own docstring still reads as a decision function — "find a
    confirming event that the webhook could not link", "an UNLINKED (or
    cross-linked) event qualifies". Both halves are now wrong: it is a suspicion
    finder, and cross-linked events cannot reach it (the feeding query at 282-293
    returns only `bookingId = this booking` or `IS NULL`, and line 202 drops the
    former). This was a round-1 P3 and round 2 added a second inconsistency on top.
    Fix: rewrite the docstring to "returns the first orphan that FITS — never a
    proof of payment", and drop "(or cross-linked)".

  [TEST FIXTURE / STALE COMMENTS] lib/jobs/__tests__/reconcilePayments.int.test.ts:41-42, 252-253
    The fixture headers still describe the deleted behaviour: "one bank_transfer
    booking recoverable from a lone orphan", "must compete for a SINGLE orphan
    (only one may be paid)", "(ORDER BY createdAt ASC) may be paid — the other must
    not bank the same money". The assertions below them now say the opposite. In a
    file whose whole lesson (per the new CLAUDE.md entry) is that the earlier
    framing was the bug, leaving the earlier framing in the comments is exactly the
    trap that produced it.

  [TEST / RISK PATH — negative scoping still untested]
  lib/payment/processWebhook.ts:196   (round-1 P2, downgraded)
    Still no test asserts a momo / vnpay / card `booking_not_found` writes NO
    orphan. Downgraded because the consequence is now orphan-table growth plus
    spurious holds rather than a credit. Fix unchanged: a `processWebhook` case
    with adapter `'momo'` + unresolvable orderRef asserting
    `paymentEvent.count({ where: { bookingId: null } })` unchanged.

  [PERF / UNVERIFIED PLAN] prisma/migrations/20260723180000_…/migration.sql
    The partial index is right on paper, but nobody has run `EXPLAIN` on the real
    OR-shaped query to confirm the planner picks BitmapOr rather than a seq scan
    (with a near-empty table it will seq-scan today regardless). Worth one
    `EXPLAIN (ANALYZE)` against a seeded orphan set, pasted into the migration
    comment — the comment currently asserts the cost model without evidence.

  [OBSERVABILITY] lib/jobs/reconcilePayments.ts:433
    `logger.warn` for a suspected unmatched payment is arguably under-level given
    it is the ONLY signal for money that may have arrived and been held. If the
    P1 marker lands, one `logger.error` (or an explicit alert route) on FIRST
    detection plus silence thereafter is the right shape.

  Carried unchanged from round 1 (all still open, all one-to-three lines):
    stale `rawBody`/`currency` on the webhook-side claim (processWebhook.ts:232);
    `recordUnmatchedPaymentEvent` "NEVER throws" has no unit test for either
    swallow arm; `sepayOrphanBody` derives `id: 1` for both digit-free txn names
    (int test:57); `verifyWebhook` parsed twice per delivery (route.ts:71); the
    seven MoMo fakeTx mocks hardcoding `updateMany → {count:0}`.


SUMMARY: 1 P1, 2 P2, 8 P3   (round 1: 1 P1, 4 P2, 7 P3)

Round 2 is a genuine improvement and the reasoning behind it is right: the
degraded predicates identify no payer, so the only defensible action is to
refuse to act. Deleting the auto-pay took the round-1 P1 exploit, the ABBA
deadlock, and the silent-burn P3 with it, and the inverted tests now assert a
safety property instead of a consistency property. The partial index is correct
and correctly SQL-only.

The remaining blocker is the other half of that decision. "Never pay, never
expire, resolve by hand" is only safe if hand-resolution is reachable — and today
the held state is unobservable (no queue, no alert, no metric, no customer
notice) and unbounded (no drain, monotonic accumulation, and a 200-row candidate
window it will eventually fill, silently disabling the sweeper). A single
persisted marker plus its exclusion in the candidate WHERE closes both.


RECOMMENDED NEXT STEPS:
  → P1: add the persisted suspicion marker + exclude it from the candidate query
    + count it in the job's output + write down the human path. Small diff, and
    it is the half of the round-2 decision that is missing.
  → P2 accountNumber gate is now cheap (no money path to re-argue) and removes
    the main false-suspicion source feeding the P1 — do them together.
  → P2 retention/redaction arm can ride a follow-up issue if the deploy is
    time-boxed, but file it before merge.
  → P3s: the three doc/comment drifts (line 430, 183-190, int fixture headers) are
    worth doing in this push — this PR's own Mistake Log entries are about stale
    framing surviving a fix.
  → No need for a round 3 on the sweeper if the P1 lands as described; re-run
    `/code-review 324` after the accountNumber gate, since it adds a `getEnv()`
    edge to the adapter's unit-test module graph (Mistake Log 092b).
