CODE REVIEW — PR #301 "feat(ledger): migrate Payout to BigInt + Neon index readiness" @ b4cd55f6
────────────────────────────────
Mode: PR (re-review — supersedes docs/qa/code-review-pr301-20260716.md @ f66a1caf)
Diff scope: 33 files, +677 / -79 (25 source/test files + 8 docs/qa carry-ins)
Base: master (now at cd08dcb — 10 days and PRs #320–#342 ahead of the first review)
CI: ALL GREEN (Lint & Typecheck, Unit, Integration, E2E chromium + mobile-390, flaky-e2e,
    data-leak, dep-audit, greppable-invariants, gitleaks, Vercel preview)

STATUS: HELD. Blocked on #362 (bounded advisory lock in createHold) and #363
(client.ts reads validated config). Do not merge.


PRIORITY 1 — Block push, fix first:

  [CORRECTNESS / CONFIG — RISK PATH] lib/core/db/client.ts:14-27
    Two coupled changes ship together, neither mentioned in the PR body:
      max: 5 → 1   AND   connectionTimeoutMillis: 3_000 → 10_000.
    The pool-size flip is the intended change. The timeout widening is the dangerous
    half: at max:1 every concurrent query on a warm Vercel instance QUEUES on the
    single connection, and this PR triples how long it queues before failing.
    Against open issue #362 — lib/core/db/holdRepo.ts:97 takes a BLOCKING
    `pg_advisory_xact_lock` inside `prisma.$transaction` — one hot trip parks the
    only connection and every other request on that instance now waits 10s instead
    of 3s before erroring. That converts a fast-fail into a Vercel function timeout
    and a user-visible hang. The two changes have different risk profiles and should
    not land as one undiscussed line.
    Fix: land AFTER #362 + #363. Justify connectionTimeoutMillis separately, or keep
    3_000 in this PR and raise it only once the lock is bounded.

  [CORRECTNESS / MONEY — RISK PATH] lib/ledger/getRevenueReport.ts:142-143
    `platformFeeVnd: Number(platformFee)` / `netPayoutVnd: Number(net)` converts the
    freshly-BigInt `calcPayout()` output straight back to Number at the DTO boundary,
    while the three sibling DTOs in the same commit (getPayoutReport, getPayoutQueue,
    getOperatorDetail) all use `.toString()`. Flagged P3 by the 2026-07-16 code-review
    and P2 by the 2026-07-16 architect-review; unfixed 10 days later.
    Compounding (not in either prior report): `RevenueRow.netPayoutVnd` is the base of
    a CLIENT-SIDE `reduce((s,r) => s + r.netPayoutVnd, 0)` in
    app/op/(console)/reports/revenue/RevenueClient.tsx — so it is a Number-domain
    ACCUMULATION over an unbounded date range, not a single value. This is the exact
    precision-loss domain CLAUDE.md's 2026-05-19 Issue 016 rule exists to close, and
    this PR reopens it inside the very commit whose stated purpose is closing it.
    Fix: serialize to string like its three siblings; sum in BigInt or on the server.

  [MONEY / DISPLAY BOUNDARY] app/op/(console)/money/page.tsx:48,52 ·
                             app/op/(console)/reports/payouts/PayoutsClient.tsx:38
    Four VND formatters now exist across the two consoles, in TWO incompatible
    patterns, all introduced or touched by this PR:
      LOSSLESS  app/admin/(console)/finance/page.tsx:45
                app/admin/(console)/operators/[id]/page.tsx:31
                  → `BigInt(string)` then `Intl.NumberFormat.format(bigint)`
      LOSSY     app/op/(console)/money/page.tsx:48  fmtVndStr
                  → `VND.format(Number(BigInt(minor)))`  (BigInt round-trip then
                     immediately discarded through Number — strictly pointless)
      LOSSY     app/op/(console)/money/page.tsx:52  fmtVndNum
                  → `VND.format(Number(v))`
      LOSSY     PayoutsClient.tsx:38
                  → `Number(amount).toLocaleString('vi-VN')`
    `Intl.NumberFormat.format()` accepts a bigint natively — the admin pattern proves
    the author knew this. The operator console got the Number pattern anyway. Same PR,
    same data, two rules, no comment explaining the split. A reader cannot tell which
    is intended, so the next Payout-derived display will pick wrong.
    Fix: one rule. `BigInt(amount)` → `Intl.format`, everywhere.

  [DIFF HYGIENE / SPEC — MISTAKE-LOG MATCH] PR body vs final diff
    CLAUDE.md 2026-07-24: "before squash-merging a multi-commit PR, re-read the PR body
    and any safety/rollback doc against the FINAL diff — they were written against the
    first commit." This body was written at commit 1 on 2026-07-16 and never walked
    forward across three subsequent commits. It names migration
    `20260715010000_neon_readiness`, which does not exist — commit b4cd55f re-timestamped
    it to `20260725120000_neon_readiness`. It omits the pool/timeout change, the
    LedgerEntry index, the .env.example + CI env additions, and the retry-route response
    shape change. It has no rollback plan. On squash-merge that body becomes the
    permanent master commit message. Full treatment in the /pr-review report.


PRIORITY 2 — Fix before merge:

  [CORRECTNESS / MONEY] lib/ledger/calcPayout.ts:57,63
    The BigInt migration stopped at the OUTPUT boundary. `CalcPayoutInput.grossPaidBookings`
    is still `number`, and line 63 does `BigInt(gross)` on it. `BigInt()` throws
    `RangeError: The number ... cannot be converted to a BigInt because it is not an
    integer` for any non-integer input — an uncaught throw inside getRevenueReport's
    `.map()`, i.e. a 500 on the operator revenue report. Today `grossRevenueVnd` comes
    from an integer Prisma aggregate so it holds, but nothing in the type system or a
    test enforces it, and the PR body's claim of "bigint arithmetic end-to-end" is
    what will stop the next reader from checking.
    Fix: widen the input to `number | bigint`, or assert `Number.isInteger(gross)` with
    a typed error, and add a negative-path test.

  [MISSING ARTIFACT] prisma/migrations/20260725120000_neon_readiness/
    No `docs/migrations/20260725120000_neon_readiness-safety.md`. This is the established
    repo convention — BOTH migrations currently on master carry one
    (20260723120000_payment_event_orphan_bookingid-safety.md,
     20260723180000_payment_event_orphan_receivedat_idx-safety.md). This migration is
    strictly more dangerous than either: 6 table rewrites plus 3 index builds plus
    2 index drops on the hottest write table in the system, with an irreversible
    widening. See the /migration-safety report.

  [FAILURE MODE / OBSERVABILITY] lib/core/db/client.ts:19-25
    The new `Pool({ max: 1, connectionTimeoutMillis: 10_000 })` has no `pool.on('error')`
    handler and emits no metric on acquire-wait. Prisma is configured `log: ['error']`
    in prod. A starved pool is therefore completely silent until the 10s timeout fires
    and surfaces as a generic query error with no attribution to pool exhaustion.
    See the /observability-review report.


PRIORITY 3 — Address when convenient:

  [DEAD / DIVERGENT CODE] lib/ledger/calcPayout.ts:25 · lib/ledger/index.ts:105
    `halfEvenRound(x: number)` is exported from the domain barrel and unit-tested, but
    nothing calls it — `calcPayout` implements its own BigInt half-even inline
    (lines 70-79). Two rounding implementations, one Number-domain and one BigInt-domain,
    exported side by side from the money domain. Pre-existing (not caused by this diff),
    so out of scope by the surgical-changes rule — but this PR is the natural place to
    note it, and the three `// bigint-exempt:` comments on it exist only to keep the
    greppable-invariants CI job quiet about code with no production path.

  [READABILITY] lib/ledger/calcPayout.ts:62
    `BigInt(Math.round(platformFeePct * 10_000_000_000))` is a `Math.round(<fractional>
    * <int>)` in a money module — it trips the CLAUDE.md Issue 016 greppable smell on
    sight even though it is correct here (rate encoding, not minor-unit multiplication;
    0.06 * 1e10 rounds exactly). Worth a one-line `// bigint-exempt:` marker consistent
    with the ones already on halfEvenRound, so the next auditor doesn't re-derive it.

  [NO-OP CHANGE] e2e/op-reports.spec.ts:208
    `[BigInt(GROSS_VND), ...]` — node-postgres `prepareValue` calls `.toString()` on any
    non-object, so a plain `number` already serialized correctly to a BIGINT column.
    Harmless, but it implies a requirement that doesn't exist.


VERIFIED CLEAN (checked, no finding):

  [OK] Schema ↔ migration index parity — all four DSL changes have exactly one matching
       SQL statement and vice versa (Trip_busId_idx, LedgerEntry_operatorId_createdAt_idx,
       Hold_status_expiresAt_idx replacing Hold_expiresAt_idx, Operator_id_idx dropped).
       Issue 007 rule satisfied — no partial/WHERE indices, so none are legitimately
       SQL-only. Live `prisma migrate diff --from-config-datasource` NOT run this session
       (no applied DB); parity established by manual side-by-side audit.

  [OK] Migration ordering — 20260725120000 sorts after master's latest (20260723180000).
       The re-timestamp in b4cd55f was applied to an unmerged, never-deployed migration,
       so it does not violate "committed migrations are never edited."

  [OK] No new NOT NULL column → the Issue 012/013 grep rule does not apply. The
       type-widening corollary DOES, and is satisfied: all 8 `payout.create` /
       `INSERT INTO "Payout"` sites audited —
       lib/ledger/withdrawal.ts:222, lib/trips/completeTripCore.ts:134 (fed by
       calcPayout, now bigint), e2e/op-reports.spec.ts:204, and 5 test fixtures.
       prisma/seed.ts creates no Payout rows (deleteMany only). All covered.

  [OK] BigInt JSON-serialization audit — every route/RSC returning Payout money checked.
       app/api/op/reports/payouts/[id]/retry/route.ts serializes all 6 fields (commit
       8618573). app/api/admin/finance/payouts/[id]/retry returns only `status`.
       .../approve returns no money. All RSC paths format at render. No unserialized
       BigInt reaches `NextResponse.json`.

  [OK] .env.example + CI coverage for the pool override — `DATABASE_POOL_MAX="5"` in
       .env.example, and set on all three DB-backed CI jobs (integration-tests:112,
       e2e-tests:180, flaky-e2e:262). lint-typecheck and unit-tests run against a
       placeholder DATABASE_URL and correctly do not need it. Prod is the only context
       that falls through to 1. Coverage is correct and complete.

  [OK] lib/jobs/processPayouts.ts:120 `-payout.net` — correct, and drops a redundant
       BigInt() round-trip now that net is natively bigint.

  [OK] No secrets, no console.log/debugger, no .only/.skip, no commented-out blocks,
       no lockfile churn, no unrelated formatting churn in the diff.

  [OK] Test coverage of diff — all touched behaviour has updated assertions
       (calcPayout.test 6 cases → BigInt, withdrawal.test, withdrawal.int.test,
       chargeback.int.test, retryPayout.int.test, cronJobs.int.test, both admin tests,
       op-reports e2e). Integration + E2E green against a real DB, which is the layer
       that actually proves the column-type change.


SUMMARY: 4 P1, 3 P2, 4 P3

RECOMMENDED NEXT STEPS:
  → Do not merge. Ordering is #362 → #363 → #301.
  → P1s are all fixable in-place on this branch; none require a design change.
  → Re-run this review after the #362/#363 rebase — the pool P1 changes character once
    the advisory lock is bounded.
