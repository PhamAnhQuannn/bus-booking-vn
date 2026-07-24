CODE REVIEW — PR #324 "fix(payments): reconcile sweeper could not recover ANY bank transfer (Bug B)" @ 0435fe17
────────────────────────────────
Diff scope: 15 files, +846 / -59 lines
Base: master · Head: fix/bank-transfer-reconcile-orphan · Mode: PR (read-only)
Reviewed: 2026-07-23

Scope note: this review covers the line-level diff only. `/verify` (tsc, lint, tests)
and `/smoke-test` are assumed already green per the PR body (1670 unit / 228 int).

Verified-correct up front (the four hazards the author called out):

  ✔ Claim-then-insert IS semantically equivalent to the old insert+P2002 for a true
    duplicate. `updateMany({ adapter, providerTxnId, bookingId: null })` cannot match
    an already-LINKED row, so the code falls through to `create` → P2002 → outer catch
    at processWebhook.ts:438 → 200 `{message:'ok'}`. Byte-identical to master.
  ✔ `recoverSepayEvent`'s `transferType === 'in' && transferAmount > 0` success
    predicate is sound. Every row with `adapter='bank_transfer'` is created at exactly
    two sites (processWebhook.ts:232/242 and recordUnmatchedPaymentEvent), both
    downstream of `verifyWebhook`, which already enforced in/`>0` (bankTransfer.ts:84-92).
    `select.ts:33` short-circuits bank_transfer past the stub, so a stub-shaped body
    can never be stored under that adapter label. No backfill needed for existing rows.
  ✔ The CAS read-your-own-writes reasoning holds. `withAdvisoryLock` wraps the whole
    tick in ONE `prisma.$transaction` on one connection (withAdvisoryLock.ts:33), and
    the per-candidate orphan query (reconcilePayments.ts:258-281) re-reads
    `PaymentEvent` inside that same tx, so it sees the uncommitted claim. No in-memory
    exclusion set needed, as documented.
  ✔ The orphan write on `booking_not_found` adds no meaningful enumeration signal.
    Status/body/headers are identical on both branches, and the endpoint is behind a
    `timingSafeEqual` API-key gate. The added INSERT (~1-3ms) is still far below the
    found-booking branch's full `$transaction`, so the pre-existing timing delta is
    unchanged in direction and dwarfs the new one.
  ✔ Test quality is materially better than this repo's baseline. The unit suite feeds
    ONE SePay constant through the REAL `verifyWebhook` and stages that SAME string as
    the stored `rawBody` (reconcilePayments.test.ts:299-355), and `recoverSepayEvent`
    round-trips the adapter's own accepted body (bankTransfer.test.ts:288-296). The
    integration suite proves the claim COMMITTED (`orphan?.bookingId`) and that one
    transfer yields exactly one `booking_credit`. These are independent evidence, not
    both-sides-hand-typed.
  ✔ Migration is catalog-only (`DROP NOT NULL`), FK left at RESTRICT — matches the
    deployed constraint from 20260518161139 verbatim, so schema.prisma ↔ DB stay in
    parity with no drift. Deploy-order note in the PR body is correct.
  ✔ Diff hygiene clean: no console.log / debugger / .only / .skip / stray TODO.


PRIORITY 1 — Block merge, fix first:

  [SECURITY / MONEY — receiving account never validated] lib/payment/adapters/bankTransfer.ts:93
    `const unmatched = { providerTxnId: String(payload.id) }` is set for ANY inbound
    SePay delivery, with zero check that the money landed in OUR receiving account.
    `payload.accountNumber` and `payload.subAccount` are declared on the interface
    (bankTransfer.ts:30-31) and then never read anywhere in the file — grep confirms
    no `accountNumber` comparison exists in lib/ or app/ outside the payout domain.

    Before this PR that was inert: no orphan row could exist, so an unmatchable
    transfer was dropped and `matchDegraded`'s `bookingId IS NULL` branch was dead
    code in production (the PR body says exactly this). This PR turns that branch on.
    The resulting live decision path for a memo-less transfer is:

        exact amount  +  adapter === booking.paymentMethod  +  ±30 min window

    `usedAdapters` is explicitly documented as "our proxy for which account the money
    landed in — there is no separate account column" (reconcilePayments.ts:33-34). It
    is now load-bearing, and the proxy is unverified: any inbound transfer into any
    SePay-connected account, with no recognisable memo, at exactly a stuck booking's
    fare, inside ±30 min of hold creation, will mark a stranger's booking `paid`,
    credit the operator ledger, and fire the customer + operator paid SMS. A customer
    paying an unrelated invoice into the same bank account is enough — no attacker
    needed. It is also trivially griefable by anyone who can read a fare page.

    The signal to bound this is already in the config: `VIETQR_ACCOUNT_NUMBER`
    (lib/config/env.ts:123), which is prod-required and rejected at its default
    (env.ts:407-412) whenever `PAYMENTS_STUB=false`.

    Fix: in `verifyWebhook`, only populate `unmatched` when
    `payload.accountNumber === getEnv().VIETQR_ACCOUNT_NUMBER` (decide subAccount
    policy explicitly and comment it — SePay uses it for virtual accounts). Add a
    negative unit test: valid inbound transfer on a foreign accountNumber → `ok:false`
    with `unmatched` UNDEFINED, i.e. no orphan, no sweepable row. Cite the SePay
    payload doc URL at the check site per the 2026-07-21 Mistake Log rule.

    (If multi-account receipt is intended, the account must become a column on
    PaymentEvent and a `matchDegraded` predicate — not left unchecked.)


PRIORITY 2 — Fix before merge:

  [FAILURE MODE / NEW DEADLOCK] lib/jobs/reconcilePayments.ts:311 ⟷ lib/payment/processWebhook.ts:232
    The CAS claim introduces a lock cycle that did not exist on master, because the
    sweeper never wrote to PaymentEvent before.

      sweeper tx:  SELECT Booking … FOR NO KEY UPDATE  →  UPDATE "PaymentEvent"
      webhook tx:  UPDATE "PaymentEvent" (claim)       →  UPDATE "Booking" (paid)

    Opposite acquisition order on the same two rows. Interleaved, Postgres detects a
    deadlock at `deadlock_timeout` and aborts one side. If it kills the sweeper, the
    ENTIRE tick rolls back — `withAdvisoryLock` holds one transaction across all 200
    candidates, so every claim and every expire in that tick is lost and `runJob`
    writes `status='failed'`. If it kills the webhook, `processWebhook`'s catch sees a
    non-P2002 error → `captureException` → rethrow → non-2xx → SePay retries.

    Self-healing in both directions (next 15-min tick / SePay's 7-attempt backoff) and
    the window is narrow, so this is not P1 — but it is a new, undocumented, untested
    failure mode on the payment rail, and the whole-tick rollback amplitude is large.

    Fix: make the sweeper's claim non-blocking so it can never sit in the cycle —
    `SELECT id FROM "PaymentEvent" WHERE id = $1 AND "bookingId" IS NULL FOR UPDATE
    SKIP LOCKED` before the UPDATE (no row → treat as claim-lost, same log line as
    today), or `FOR UPDATE NOWAIT` with the error mapped to claim-lost. At minimum,
    document the cycle in the CONCURRENCY block at reconcilePayments.ts:40-49 — that
    block currently claims full concurrency coverage and does not mention it.

  [PII / RETENTION — new orphaned row class] prisma/schema.prisma:418, lib/payment/processWebhook.ts:110
    Orphan PaymentEvents fall outside every retention and anonymisation path:
    `lib/jobs/retentionSweeper.ts` and `lib/account/anonymizeCustomer.ts` never touch
    PaymentEvent at all, and an orphan is unreachable through the `booking` relation
    filter every other cleanup uses. The PR's own tests are the tell — both int suites
    had to add a delete-by-`providerTxnId` pass with the comment "unreachable through
    the `booking` relation filter" (reconcilePayments.int.test.ts:297,
    bankTransferWebhook.int.test.ts:143).

    `rawBody` on those rows retains the payer's name in `content` (the fixtures show
    the real shape: `'CK tu NGUYEN VAN A khong ghi noi dung'`), plus `accountNumber`,
    `gateway`, and `referenceCode` — indefinitely, with no subject linkage, so a
    customer erasure request cannot even locate it. Note `accountNumber` is on the
    logger redact list (lib/logger.ts:101) precisely because the project treats it as
    sensitive; it is not logged here, but it is now persisted unbounded.

    Fix: add an orphan arm to `retentionSweeper` — delete or redact `rawBody` on
    `PaymentEvent WHERE "bookingId" IS NULL AND "receivedAt" < now() - <policy>`, with
    the window comfortably longer than `DEGRADED_MATCH_WINDOW_MINUTES` and long enough
    for manual bank-statement triage (the schema comment at line 418 correctly warns
    never to delete one un-reconciled). Route the policy through
    `lib/account/retentionPolicy.ts` rather than a literal.

  [PERF / UNINDEXED SWEEPER PREDICATE] lib/jobs/reconcilePayments.ts:258-281, prisma/schema.prisma:435
    The per-candidate orphan lookup is
    `pe."bookingId" IS NULL AND pe."receivedAt" BETWEEN ? AND ?`, executed once per
    candidate (up to CLAIM_LIMIT = 200 per tick, every 15 min). PaymentEvent has only
    `@@unique([adapter, providerTxnId])` and `@@index([bookingId])` — nothing on
    `receivedAt`. Postgres can use the bookingId index for `IS NULL` and then filters,
    so cost scales with the TOTAL orphan count, which now grows monotonically forever:
    every memo-less transfer creates one and nothing ever removes an unclaimed one.

    This is the same shape as the CLAUDE.md rule "Cron/sweeper WHERE predicates MUST be
    top-level indexed columns" (Issue 014) — `receivedAt` is top-level but unindexed.

    Fix: add to the SAME migration —
    `CREATE INDEX "PaymentEvent_orphan_receivedAt_idx" ON "PaymentEvent"("receivedAt")
     WHERE "bookingId" IS NULL;`
    Partial/WHERE index → stays SQL-only per the project rule, no `@@index` in
    schema.prisma (matches the Issue 007 precedent).

  [TEST / RISK PATH — negative scoping untested] lib/payment/processWebhook.ts:196
    `if (adapter === 'bank_transfer' && status === 'paid')` is the guard the PR body
    argues hardest for ("recording it would add noise and widen the sweeper's
    false-positive surface"), and only its TRUE side is covered. No test asserts that
    a momo / vnpay / card `booking_not_found` writes NO orphan — grep for
    `booking_not_found` across the payment tests returns exactly one hit, a comment in
    the bank_transfer int suite. Delete the `adapter ===` clause and every suite stays
    green while every unknown-ref MoMo IPN becomes a sweepable orphan — i.e. the exact
    double-credit surface this PR was written to close.

    Also note the `status === 'paid'` half is structurally unreachable: the
    bank_transfer adapter's only `ok:true` return hardcodes `status: 'paid'`
    (bankTransfer.ts:167). It is harmless defence-in-depth, but no test can reach its
    false side either.

    Fix: add a `processWebhook` unit/int case — adapter `'momo'`, unresolvable
    orderRef → 200 AND `paymentEvent.count({ where: { bookingId: null } })` unchanged.
    (Strict reading of the skill rubric puts a missing test on a money-path branch at
    P1; filed P2 because the positive path IS covered and the exposure is regression
    risk, not a live defect.)


PRIORITY 3 — Address when convenient:

  [CORRECTNESS / SILENT] lib/jobs/reconcilePayments.ts:317-337
    On a successful CAS the orphan is permanently linked, but if
    `applyPaidStatusTransition` then returns `updated === 0` the code falls straight
    through the `if (updated > 0)` block to `continue` — no ledger, no notification,
    and no log line at all. The orphan is burned and can never be re-matched by any
    other booking. Unreachable today (the candidate row is held by
    `FOR NO KEY UPDATE` and was selected on `status='awaiting_payment'`, which is a
    legal predecessor of `paid`, so applyPaidTransition.ts:78 cannot return 0), but it
    is an unlogged money-visibility hole one transition-map edit away.
    Fix: `else if (claimedOrphan) logger.error(...)` — a claimed orphan with no paid
    transition must never be silent.

  [READABILITY / DEAD CONDITION] lib/jobs/reconcilePayments.ts:172-176, 189
    The `matchDegraded` docstring says an "UNLINKED (or cross-linked) event qualifies",
    and line 189 guards `if (ev.bookingId === booking.id) continue`. The feeding query
    (lines 269-280) only ever returns `bookingId = booking.id` OR `bookingId IS NULL`,
    so a cross-linked event can never be a candidate — and the CAS
    `AND "bookingId" IS NULL` would reject it even if one arrived. Line 189 is
    effectively `if (ev.bookingId !== null) continue`.
    Fix: drop "(or cross-linked)" from the doc, or state that cross-linked events are
    deliberately excluded at the query and reinforced at the claim.

  [CORRECTNESS / STALE ROW] lib/payment/processWebhook.ts:232-235
    The claim sets only `bookingId` — the claimed row keeps the `rawBody` and the
    hardcoded `currency: 'VND'` written by `recordUnmatchedPaymentEvent`, not the
    values from the delivery that resolved. Benign today (same `providerTxnId` ⇒ same
    SePay transaction ⇒ same body, and bank_transfer is VND by construction), but
    `rawBody` is the audit artifact and the long comment above the claim does not say
    why leaving it stale is safe.
    Fix: one sentence in that comment, or include `rawBody` / `currency` in the
    `data:` of the updateMany.

  [TEST / UNASSERTED CONTRACT] lib/payment/processWebhook.ts:106-108
    "NEVER throws" is documented as load-bearing — the bank_transfer route `await`s
    this before its 200 ack (route.ts:79-84), so a throw converts a
    recorded-unmatched transfer into a 500 + SePay retry. Neither swallow arm has a
    unit test: the P2002 path is only reached incidentally by the int suite, and the
    generic-error path (logger.error + captureException) is never exercised.
    Fix: two unit tests with a mocked `prisma.paymentEvent.create` rejecting with
    P2002 and with a generic error — both must resolve, not reject.

  [TEST FIXTURE / SELF-INCONSISTENT] lib/jobs/__tests__/reconcilePayments.int.test.ts:57
    `sepayOrphanBody` derives the body's `id` as
    `Number(id.replace(/\D/g, '') || '1')`. Both `'recon-sepay-solo'` and
    `'recon-sepay-pair'` are digit-free, so both bodies embed `id: 1` while their
    `providerTxnId` columns are the string names. Harmless — `recoverSepayEvent`
    ignores `id` — but it breaks the one-producer discipline this PR argues for
    elsewhere and would silently mask any future change that reads `id` from the body.
    Fix: use numeric txn ids (e.g. `901`/`902`) and set `providerTxnId` from the same
    constant.

  [HYGIENE / DOUBLE WORK] app/api/payments/bank_transfer/webhook/route.ts:71
    `verifyWebhook(rawBody)` now runs twice on every non-short-circuit delivery — once
    for `preVerify`, once inside `processPaymentWebhook`. Pre-existing shape, but this
    PR made `preVerify` load-bearing, so it is worth a comment noting the parse is
    deliberately duplicated (pure function, no side effects) rather than threaded.

  [HYGIENE / MOCK UNIFORMITY] app/api/payments/momo/webhook/__tests__/route.test.ts (7 sites)
    All seven fakeTx mocks hardcode `updateMany: … ({ count: 0 })`, so no MoMo test can
    ever exercise the claim branch. Correct for MoMo (it never produces orphans), but
    it means these mocks would not catch a regression that starts claiming on the MoMo
    path. Consider one MoMo test with `count: 1` asserting `create` is NOT called and
    the transition still runs — cheap, and it pins the branch.


SUMMARY: 1 P1, 4 P2, 7 P3

The two headline defects (B1 adapter-dispatch, B2 orphan persistence) are correctly
diagnosed and correctly fixed, the double-credit CAS is genuinely load-bearing and
genuinely proven by the integration test, and the test discipline is a clear step up
from the #320/#322 baseline. The single blocking concern is that switching the
degraded-match branch from dead code to live money path exposes an input the adapter
has always ignored: no code anywhere checks that a SePay transfer landed in OUR
receiving account, and after this PR the memo-less path has no other identity signal.


RECOMMENDED NEXT STEPS:
  → Fix P1 (receiving-account validation + negative test) before merge — it converts a
    previously-inert gap into a live money path.
  → P2 deadlock + P2 partial index are both small and belong in this PR (the index in
    the SAME migration, per the Issue 007 precedent).
  → P2 retention arm and the P2 negative-scoping test can ride a follow-up issue if
    the deploy is time-boxed, but file them before merge, not after.
  → P3s are all one-to-three-line comment/test changes; batch them into the same push.
  → Re-run `/code-review 324` after the P1 fix — the new `getEnv()` dependency in the
    adapter changes its unit-test module graph (see Mistake Log 092b).
