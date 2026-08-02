CODE REVIEW — PR #358 "feat(admin): surface orphan-payment backlog + split dead vs retrying alerts (#327)" @ `027c8292`
────────────────────────────────
Base: `master` · Head branch: `feat/orphan-backlog-metric-327` · State: OPEN, ready
Diff scope: 4 files, +128 / -25 lines

Files reviewed:
- `app/admin/(console)/page.tsx` (+14 / -4)
- `lib/admin/getFailureAlerts.ts` (+40 / -20)
- `lib/admin/__tests__/getFailureAlerts.test.ts` (new, +73)
- `lib/notification/index.ts` (+1 / -1)

CI note: `E2E (mobile-390) = FAILURE` on run `30179356272` is `##[error]Docker pull failed with exit code 1`
— infra flake, NOT a code finding. Excluded from this review.

---

PRIORITY 1 — Block push, fix first:

  (none)

---

PRIORITY 2 — Fix before merge:

  [CORRECTNESS / MONEY-OBSERVABILITY] lib/admin/getFailureAlerts.ts:61
    `prisma.paymentEvent.count({ where: { bookingId: null } })` is presented (tile label
    "Giao dịch chưa khớp", hint "chuyển khoản chưa gán được đơn") as an actionable backlog,
    but `bookingId IS NULL` is a LIFETIME CUMULATIVE counter, not a work queue. Three
    distinct causes write orphan rows:
      1. `no_booking_ref_in_memo` — our money, unmatchable memo. Actionable.
      2. `account_mismatch` (Issue 334) — `app/api/payments/bank_transfer/webhook/route.ts:78-91`
         records an orphan for a transfer that landed in an account that is NOT the
         configured VietQR account. The route's own comment says "Not our money — never
         credit." These rows are **permanently unresolvable by any admin action**.
      3. `booking_not_found` inside `lib/payment/processWebhook.ts`.
    The ONLY decrement path in the entire codebase is `processWebhook.ts:234`
    (`tx.paymentEvent.updateMany({ where: { adapter, providerTxnId, bookingId: null } })`),
    which fires only when the SAME `providerTxnId` is redelivered carrying a resolvable
    ref. The reconcile sweeper is a pure reader of `PaymentEvent` (it deliberately stopped
    writing after the 2026-07-23 Bug-B round-2 fix), and there is no manual resolve UI
    (deferred to #331). Net: cause (2) — and in practice most of cause (1) — never clears,
    so the tile ratchets upward forever and can never return to 0.
    Consequence: an alert that cannot be driven to zero is an alert operators learn to
    ignore — the same failure shape as the 2026-07-24 "permanent hold" mistake-log entry
    (a state whose release condition is a pure function of immutable inputs).
    Fix (pick one, all cheap):
      - Exclude the not-our-money class: add an `unmatchedReason`/`resolvedAt` top-level
        column (top-level + indexed, per the Issue 014 rule) and count only actionable rows;
      - or scope the count to a rolling window (`receivedAt >= now - 30d`) so the tile
        reflects a backlog rather than all-time history;
      - or at minimum relabel the tile as cumulative and split out the `account_mismatch`
        subset, and state in the PR body that the count is unclearable until #331 lands.

  [AUTHZ / ROLE-SCOPE] app/admin/(console)/page.tsx:231-235
    The new "Giao dịch chưa khớp" tile is rendered OUTSIDE the `canSeeFinance` guard
    (`ctx.role === 'SUPER_ADMIN' || 'FINANCE'`, line 89), so SUPPORT sees a
    payment-reconciliation backlog. The file's own ROLE MATRIX rationale (lines 22-24)
    states: "SUPPORT triages operators/customers/notifications but does not see money
    figures (GMV/revenue) or money-flow failures (disputes/payouts)." An unmatched-bank-
    transfer count is a money-flow failure by that definition. The matrix table itself
    (line 20) grants SUPPORT the whole "Failure alerts" section, so this is a documented
    ambiguity rather than a bypass — but the PR resolves it silently in the permissive
    direction and does NOT update the ROLE MATRIX comment block (lines 12-24) to record
    the three new tiles or the decision.
    Note the authz *gate* itself is sound and layered: Edge middleware `proxy.ts:256`
    (exact-match `Set` allowlist `ADMIN_AUTH_FREE_PATHS`, JWT-claim `scope==='admin'` +
    `totpVerified`, zero DB reads) plus in-page `requireAdminPage()` at line 85. No
    missing-authz defect. This finding is about role granularity only.
    Fix: either wrap the orphan tile in `canSeeFinance ? … : null` (consistent with the
    action-queue `Chi trả thất bại` card at line 195-209, which IS gated), or amend the
    ROLE MATRIX block to explicitly grant SUPPORT payment-reconciliation counts and say why.

  [CORRECTNESS / SIGNAL] app/admin/(console)/page.tsx:243 + 272-277
    The all-clear branch is gated only on `failures.recent.length > 0`, and `recent` is
    notification failures ONLY. With 0 failed notifications and N > 0 orphan payments the
    page renders a green `<Alert variant="success">` reading "Không có lỗi gửi gần đây /
    Tất cả thông báo và chi trả đều ổn." directly beneath a tile showing N unmatched
    transfers. The PR's entire premise is that the orphan backlog was invisible; this
    hard-codes a contradicting all-clear next to it.
    Fix: gate the success alert on `recent.length === 0 && orphanPayments === 0 &&
    deadNotifications === 0 && failedPayouts === 0`, or drop "và chi trả" from the copy.

  [COMPLETENESS / TEST] lib/admin/getFailureAlerts.ts:63-74
    The `recent` query is unchanged — `where: { status: 'failed' }`, `orderBy: createdAt
    desc`, and `attemptCount` is NOT in the `select`. So the "Thông báo thất bại gần đây"
    list re-conflates dead vs retrying, which is the exact defect the PR fixes one level
    up at tile granularity. Worse, retrying rows are (by definition) the newer ones, so
    `createdAt desc` systematically buries the permanently-dead rows a human must act on
    beneath transient blips. The new test file asserts only `take: limit` pass-through
    (`getFailureAlerts.test.ts:63-71`) and never exercises this.
    Fix: add `attemptCount` to the select and render a "dead"/"retrying" badge per row, or
    restrict `recent` to `attemptCount: { gte: MAX_ATTEMPTS }` (the needs-a-human list),
    plus a test asserting the predicate.

  [PERF / INDEX] lib/admin/getFailureAlerts.ts:55-60
    `attemptCount` has no index (`prisma/schema.prisma` NotificationLog declares only
    `@@index([bookingId])`, `@@index([template, scheduledFor])`, `@@index([status,
    nextAttemptAt])`; confirmed against `prisma/migrations/20260602080000_notification_dispatcher/
    migration.sql:20`). Both new counts therefore use the `status` prefix of
    `NotificationLog_status_nextAttemptAt_idx` and filter `attemptCount` per-row — i.e.
    they each scan the ENTIRE `status='failed'` partition. That partition has no retention
    or purge path anywhere in the repo, so it grows monotonically, and this PR doubles the
    number of full-partition scans per admin page render (1 → 2).
    Fix: `@@index([status, attemptCount])` (expressible in the Prisma DSL, so per the
    Issue 007 rule it must be declared in BOTH `schema.prisma` and the migration), or
    derive both numbers from a single `groupBy` on `attemptCount`.

---

PRIORITY 3 — Address when convenient:

  [READABILITY / AFFORDANCE] app/admin/(console)/page.tsx:221-240
    `MetricCard` has no severity affordance: `deadNotifications = 0` and `= 47` render
    identically. The Action-queue cards in the same page (lines 148-152, 185-189, 201-205)
    attach `<Badge variant="pending">` / `<Badge variant="danger">` when the count is > 0.
    The tile the PR labels "cần xử lý" (needs handling) is the one most in need of that
    treatment and is the only class of card that doesn't get it.

  [DEPENDENCY GRAPH] lib/admin/getFailureAlerts.ts:28
    `import { MAX_ATTEMPTS } from '@/lib/notification'` pulls the whole notification-domain
    barrel — `dispatchNotifications`, `esms`, `email`, and their transitives
    (`@/lib/observability`, `@/lib/logger`, `Prisma`) — into the admin Overview RSC's module
    graph, to obtain one integer. This is the CORRECT move under the ESLint barrel-only
    cross-domain rule (a deep `@/lib/notification/dispatchNotifications` import would fail
    `boundaries/entry-point`), and there is no cycle (`lib/notification` imports nothing
    from `lib/admin`; its `@/lib/jobs` import is type-only, `dispatchNotifications.ts:40`).
    Sharing the constant is genuinely better than duplicating `5` in admin. Noted only as a
    cold-start cost: a leaf `lib/notification/constants.ts` re-exported through the barrel
    would keep single-source-of-truth without the graph widening.

  [COVERAGE GAP] lib/admin/getFailureAlerts.ts:55-60
    A NotificationLog row stuck in `status='pending'` — cron disabled, or a far-future
    `scheduledFor` (see the claim predicate at `lib/notification/dispatchNotifications.ts:87-90`)
    — appears in NEITHER new tile. Pre-existing (the old single `failedNotifications` count
    had the same hole), but the PR's "dead vs retrying" framing implies exhaustive coverage
    of undelivered notifications, and it isn't.

  [HYGIENE] lib/admin/__tests__/getFailureAlerts.test.ts:14
    `type CountArgs = { where: { attemptCount?: { gte?: number; lt?: number } } }` omits
    `status`, so the mock's destructure is narrower than the real call shape. It works
    (test 2 asserts the full object via `toHaveBeenCalledWith`), but the local type
    silently under-describes the contract it is mocking.

---

CLEAN — explicitly checked, no finding:

  - **PII (#332 / rawBody):** the diff surfaces COUNTS only. No `PaymentEvent.rawBody`,
    no `NotificationLog.payload`, no new log statements at all. `getFailureAlerts.ts:67-73`
    `select` whitelist is byte-identical to master (id/template/recipient/createdAt/
    lastError) — the Issue 001 "select whitelist = exactly the UI contract" rule holds; no
    filter-only column (`attemptCount`, `status`, `bookingId`) leaked into the payload.
    `recipient` stays masked at render (`maskRecipient`, page line 256). Logger redact list
    needs no change because the PR adds no logging.
  - **Issue 014 rule (JSON-payload predicate):** both new predicates — `attemptCount` and
    `bookingId` — are top-level scalar columns. No `payload->>'` / `payload->` anywhere in
    the diff. Compliant.
  - **Unbounded query (#364 class):** the only row-returning query is `findMany` with
    `take: limit` (default 5), unchanged from master and asserted by the new test. The four
    new/changed queries are `count()` aggregates, which return a scalar — no unbounded
    materialization. `paymentEvent.count({ where: { bookingId: null } })` can use
    `PaymentEvent_bookingId_idx` (Postgres btree indexes NULLs, and `IS NULL` is
    index-searchable), and NULL is the selective side.
  - **Authz gate presence:** layered and correct — see the P2 role-scope note above.
  - **Breaking change surface:** `FailureAlerts.failedNotifications` was removed from the
    interface; grep confirms `app/admin/(console)/page.tsx` was the sole consumer and is
    updated in the same commit. No stale mock elsewhere stubs the old shape.
  - **MAX_ATTEMPTS boundary:** `gte` / `lt` exactly complement the dispatcher's claim
    predicate `"attemptCount" < ${MAX_ATTEMPTS}` (`dispatchNotifications.ts:88`), and the
    constant is now imported rather than duplicated — the split cannot drift from the
    dispatcher.
  - **RSC purity (Issue 016):** no `Date.now()` / `Math.random()` added to the render body.
  - **Test/source independence:** the mock returns distinct sentinels per branch (3 dead /
    7 retrying / 4 orphan / 2 payout) so the full-shape `toEqual` genuinely proves each
    predicate routed to the right output field — not a both-sides-encode-the-same-assumption
    fixture.

SUMMARY: 0 P1, 5 P2, 4 P3

RECOMMENDED NEXT STEPS:
  → No P1 — this PR does not need to be blocked.
  → P2 #1 (orphan count is cumulative, not a backlog) is the substantive one: decide before
    merge whether the tile is "all-time unlinked" or "needs attention", and label/scope it
    accordingly. Shipping it as an unclearable alert is the failure mode.
  → P2 #2 (role scope) needs a one-line decision + a ROLE MATRIX comment update either way.
  → P2 #3 (contradicting all-clear) and #4 (unsplit `recent` list) are small in-PR fixes.
  → P2 #5 (missing `[status, attemptCount]` index) can ride a follow-up if the failed-row
    partition is currently small — but it needs the schema.prisma + migration pair, so it is
    cheaper to do deliberately than reactively.
