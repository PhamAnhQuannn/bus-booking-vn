BACKCOMPAT REVIEW — PR #301 "feat(ledger): migrate Payout to BigInt + Neon index readiness" @ f66a1ca
─────────────────────────────────────────────────────────────────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/301
Base/Head: master ← feat/payout-bigint-neon @ f66a1caf
Size:      +100 / -78 across 23 files
Generated: 2026-07-16

Findings: 6  (P1: 1 · P2: 3 · P3: 2)

═══════════════════════════════════════════════════════════════════════════════════════════════════
P1 — BLOCKING
═══════════════════════════════════════════════════════════════════════════════════════════════════

lib/ledger/retryPayout.ts:15,54 + app/api/op/reports/payouts/[id]/retry/route.ts:35
  💥 P1: Operator payout-retry endpoint will 500 on every successful retry — raw BigInt fields
  hit JSON.stringify.

  `retryPayout()` returns `{ ok: true; payout: Payout }` where `Payout` is the raw Prisma model
  type. After this migration, `Payout.gross / platformFee / net / taxVat / taxPit / taxTotal` are
  all `bigint`. The route handler does:

      return NextResponse.json({ payout: result.payout });

  `NextResponse.json()` calls `JSON.stringify` internally, which throws
  `TypeError: Do not know how to serialize a BigInt` for any object containing a raw `bigint`
  field. This route is wrapped in `withErrorHandler`, so the crash is swallowed into a generic
  `{ error: "Internal server error" }` 500 instead of crashing the process — but the net effect
  is that **every operator "Thử lại" (retry) click now fails**, silently, in production.

  This PR touched `getPayoutQueue.ts`, `getPayoutReport.ts`, and `getOperatorDetail.ts` — each
  converting `net`/`gross`/`platformFee` to `.toString()` at the DTO boundary — but missed
  `retryPayout.ts`, which returns the raw Prisma entity instead of a DTO and was not part of the
  diff at all.

  Confirmed via the PR's own (unmodified) e2e coverage: `e2e/op-reports.spec.ts` Case 4
  ("retry button transitions payout to processing", line 315) clicks the same "Thử lại" button
  that calls this route and asserts the UI transitions to "Đang xử lý". That assertion will now
  fail — the route never returns `{ payout }` successfully, so `PayoutsClient.tsx`'s
  `retryPayoutApi()` call never gets a payout to re-render from and the status stays 'failed'.

  Fix: convert `retryPayout`'s return type to a DTO (or `.toString()` the money fields) before
  the route serializes it — same pattern already applied in `getPayoutQueue.ts` /
  `getPayoutReport.ts` / `getOperatorDetail.ts` in this same PR. Add/keep a route-level test
  under `app/api/op/reports/payouts/[id]/retry/__tests__/` that actually asserts on the
  response body shape (none currently exists) so this class of bug is caught by `pnpm test`
  before it reaches e2e.

═══════════════════════════════════════════════════════════════════════════════════════════════════
P2 — SHOULD FIX
═══════════════════════════════════════════════════════════════════════════════════════════════════

prisma/migrations/20260715010000_neon_readiness/migration.sql:2-7
  ⚠️  P2: Int→BigInt widening is data-safe but ships as 6 separate ALTER TABLE statements —
  6 full table rewrites instead of 1.

      ALTER TABLE "Payout" ALTER COLUMN "gross" SET DATA TYPE BIGINT;
      ALTER TABLE "Payout" ALTER COLUMN "platformFee" SET DATA TYPE BIGINT;
      ... (4 more, one per column)

  Widening `Int`→`BigInt` cannot lose data (every int4 value fits in int8) — no truncation risk
  on the forward migration. However, int4→int8 is not a binary-coercible cast (storage width
  changes from 4 to 8 bytes), so Postgres cannot do it in-place: **each** `ALTER COLUMN TYPE`
  statement requires a full table rewrite under `ACCESS EXCLUSIVE` lock (blocks all reads and
  writes on `Payout` for the duration). Issuing 6 separate `ALTER TABLE` statements against the
  same table triggers 6 separate rewrite passes; combining all 6 `ALTER COLUMN TYPE` clauses into
  a single `ALTER TABLE "Payout" ALTER COLUMN "gross" TYPE BIGINT, ALTER COLUMN "platformFee" TYPE
  BIGINT, ...;` statement lets Postgres do one rewrite pass for all six.
  At current launch scale (1-2 family operators, per project memory) the `Payout` table is tiny
  and the lock duration is negligible either way — but the PR's own stated goal is "Neon
  readiness" for future scale, and shipping a migration pattern that's 6x more expensive than
  necessary undercuts that goal and will bite on the next such migration once the table is large.
  Fix: combine into one `ALTER TABLE` statement in a forward migration (committed migrations are
  never edited per project rule). Rollback note: a future reverse migration (BigInt→Int) would
  have real truncation risk once any `Payout.gross`/`net`/etc. exceeds `2,147,483,647` VND — worth
  a guard/backfill check if this migration is ever reverted.

lib/core/db/client.ts:14,17-18
  ⚠️  P2: `DATABASE_POOL_MAX` default silently drops 5→1 for every deployment that doesn't set it
  explicitly; stale docs and a second unwired config source compound the risk.

      const max = Number(process.env.DATABASE_POOL_MAX) || 1;   // was: || 5
      ...
      connectionTimeoutMillis: 10_000,                          // was: 3_000

  This is likely intentional for the Neon-pooled-serverless deployment model (small per-instance
  pool + Neon's own connection pooler, longer timeout to tolerate cold-start latency) — but it's
  a global default change with no accompanying doc/config update:
    - `documentation/current-status/06-lib-core.md:52` still says "configurable `DATABASE_POOL_MAX`
      (default 5)"; line 331 of the same file says default `1`. Neither matches or was corrected
      by this PR.
    - `lib/config/env.ts:303` already independently declares
      `DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(1)` via the Zod schema —
      but `client.ts` reads raw `process.env.DATABASE_POOL_MAX` directly, never `getEnv()`. Two
      disconnected sources of truth for the same knob now coincidentally agree at `1`, but issue
      114's AC explicitly called for `new Pool()` to receive `{ max: env.DATABASE_POOL_MAX }`
      (never implemented) and for the Zod default to be `5` (already diverged before this PR).
    - `.env.example:144-147` documents a **self-hosted Docker + PgBouncer** deployment path as a
      supported option alongside Vercel+Neon. A self-hosted long-running Node process serving
      concurrent requests through a single pooled connection (`max=1`) is a real throughput
      regression if that path is ever used, unlike the serverless-per-invocation model where
      `max=1` is appropriate.
  Fix: wire `client.ts` through `getEnv().DATABASE_POOL_MAX` (closing the original issue-114 gap
  in the same commit), pick one canonical default and apply it in both places, and update
  `06-lib-core.md` to match.

lib/core/db/__tests__/holdCap.int.test.ts, lib/trips/__tests__/createTrip.int.test.ts,
lib/booking/__tests__/checkIn.int.test.ts, lib/charter/__tests__/claimCharter.int.test.ts,
lib/ledger/__tests__/{withdrawal,retryPayout}.int.test.ts, and 6 more (~12 files total)
  ⚠️  P2: Pool max=1 collapses "concurrent" integration-test `Promise.all`/`Promise.allSettled`
  calls onto a single physical connection, masking the DB-level race conditions they exist to test.

  These integration tests fire multiple simultaneous requests (e.g.
  `Promise.allSettled(tripIds.map(tripId => createHold(...)))` in `holdCap.int.test.ts`,
  6-way concurrent `create()` in `createTrip.int.test.ts`) specifically to exercise
  `SELECT ... FOR UPDATE` / `pg_advisory_xact_lock` contention and atomic conditional-UPDATE
  races at the database. With `DATABASE_POOL_MAX=1` and a single shared `PrismaClient` per test
  file, these "concurrent" calls now queue at the `pg.Pool` level and execute one at a time —
  the pool, not the database lock, is what serializes them. Final assertions will very likely
  still pass (the correctness invariants are enforced regardless of interleaving order), so this
  is not expected to break `pnpm vitest:int` outright — but it silently degrades these tests'
  ability to catch a real regression in the underlying locking code, since the concurrent code
  path they're meant to exercise may no longer actually run concurrently. Combined with the
  `connectionTimeoutMillis` bump to 10s, tests with higher fan-out (6+ simultaneous calls) will
  also run measurably slower. Fix: either set `DATABASE_POOL_MAX` explicitly higher for the
  integration-test env (e.g. in `vitest.integration.config.ts` env block), or accept the
  trade-off explicitly with a comment — but a silent default change is the wrong way to discover
  this.

═══════════════════════════════════════════════════════════════════════════════════════════════════
P3 — ADVISORY
═══════════════════════════════════════════════════════════════════════════════════════════════════

lib/ledger/getRevenueReport.ts:138-139
  ℹ️  P3: Inconsistent money-DTO convention within the same PR — `RevenueReportRow` downcasts
  bigint back to `Number()` while sibling DTOs (`PayoutReportRow`, `PayoutQueueRow`,
  `OperatorPayoutHistoryItem`) were changed to `string`. Not a bug — a single trip's VND figures
  are far below `Number.MAX_SAFE_INTEGER` — but a future payout-money DTO added to this codebase
  has two different precedents to copy from. Worth a one-line note on which convention is
  canonical (string is the safer default since it never silently re-introduces float/precision
  loss as amounts grow).

documentation/current-status/06-lib-core.md:52,331
  ℹ️  P3: Doc drift — describes `DATABASE_POOL_MAX` default as both "5" (line 52) and "1"
  (line 331), neither of which was reconciled with the `client.ts` change in this PR. See the P2
  pool-config finding above; fold the doc fix into that same commit.

═══════════════════════════════════════════════════════════════════════════════════════════════════
VERIFIED CLEAN (review focus areas checked, no defect found)
═══════════════════════════════════════════════════════════════════════════════════════════════════

- **Index drops**: `Hold(expiresAt)` → `Hold(status, expiresAt)` and `Operator(id)` drop were
  checked against every call site (`lib/core/db/holdRepo.ts`, `lib/jobs/expireHolds.ts`,
  `app/api/cron/sweep-holds/route.ts`). Every Hold query in the codebase filters on `status` AND
  `expiresAt` together — none filter `expiresAt` alone — so the composite index is a strict
  improvement with no query-plan regression. `Operator.id` already carries an implicit unique
  index via `@id`, so `@@index([id])` was fully redundant; the drop is safe.
- **Schema/migration DSL parity**: all 3 new indices (`Trip_busId_idx`,
  `LedgerEntry_operatorId_createdAt_idx`, `Hold_status_expiresAt_idx`) and both drops are declared
  symmetrically in `prisma/schema.prisma` `@@index` blocks and `migration.sql` — complies with the
  project rule that DSL-expressible raw-SQL indices must also be declared in the schema.
- **Test fixture coverage for the BigInt column change**: grepped every `prisma.payout.create` /
  `tx.payout.create` (7 call sites) and the one raw `INSERT INTO "Payout"` (`e2e/op-reports.spec.ts`)
  across `lib/**`, `e2e/**`. All are either updated to pass `BigInt(...)` literals in this diff, or
  (in `lib/trips/completeTripCore.ts`) derive their values directly from `calcPayout()`, whose
  return type is now `bigint` — no missed fixture found.
- **Reverse-direction serialization audit**: swept every `app/api/**` route touching `Payout`
  (11 routes) for a raw entity passed to `NextResponse.json()`; only the retry route (P1 above)
  does so. `app/api/cron/process-payouts/route.ts` returns `{ rowsAffected, status }` (numbers
  only); `app/api/op/trips/[id]/complete/route.ts` returns `trip` + a count, never the payout row;
  admin approve/retry routes return only `{ ok, status }` string fields.

SUMMARY: 1 P1 · 3 P2 · 2 P3
