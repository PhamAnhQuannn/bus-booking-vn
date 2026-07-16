ARCHITECT REVIEW — PR #301 "feat(ledger): migrate Payout to BigInt + Neon index readiness" @ f66a1caf
─────────────────────────────
Base: master · Head: feat/payout-bigint-neon · State: OPEN
URL: https://github.com/PhamAnhQuannn/bus-booking-vn/pull/301
Scanned: 23 changed files (+100/-78, 1 commit); dependency-flow, index-parity, and BigInt-boundary audit of the diff plus its direct consumers.

PRIORITY 1 — Block push, fix first:
  none

PRIORITY 2 — Fix before next release:

  [BIGINT BOUNDARY INCONSISTENCY] lib/ledger/getRevenueReport.ts:142-143 vs. lib/ledger/getPayoutReport.ts / lib/admin/getPayoutQueue.ts / lib/admin/getOperatorDetail.ts
    Three of the four DTOs touched in this PR serialize BigInt at the boundary via `.toString()` (PayoutReportRow.gross/platformFee/net, PayoutQueueRow.net, OperatorPayoutHistoryItem.net). `getRevenueReport` instead does `platformFeeVnd: Number(platformFee), netPayoutVnd: Number(net)` — converting straight back to Number at the same DTO layer. Both values originate from the same `calcPayout()` (now BigInt-returning) call, in the same domain barrel (`lib/ledger`), in the same commit. There is no comment or convention documenting why this one DTO gets the Number path while its siblings get the string path — the next person to touch a Payout-derived DTO has no rule to follow.
    Compounding: `RevenueRow.platformFeeVnd`/`netPayoutVnd` feed `app/op/(console)/reports/revenue/RevenueClient.tsx:74-76`, which does `.reduce((s, r) => s + r.netPayoutVnd, 0)` across every row in the operator's selected date range — i.e. the Number-domain conversion isn't even scoped to a single value, it's the base of a client-side aggregation. Not a live bug at current VND magnitudes, but it silently reopens exactly the precision-loss domain Issue 016 / this PR exist to close.
    Fix: either convert `getRevenueReport` to the string convention (and have `RevenueClient.tsx` parse via `BigInt`/aggregate in BigInt domain, converting to Number only for the final render), or write down — in `lib/ledger/index.ts` or a short domain-level comment — which DTOs are allowed to use Number (bounded, single-row, provably-small values) vs. which must use string (anything that can be summed or is unbounded).

  [BIGINT BOUNDARY INCONSISTENCY] app/op/(console)/reports/payouts/PayoutsClient.tsx:38-39 and app/op/(console)/money/page.tsx:52-53 vs. app/admin/(console)/operators/[id]/page.tsx:31-33 and app/admin/(console)/finance/page.tsx:45-48
    Same class of issue, one layer up, in files this PR itself modified. The two admin pages' `formatVnd()` was updated to accept `bigint | number | string`, widen a string back to `BigInt`, and hand the bigint straight to `Intl.NumberFormat.format()` (which natively accepts `bigint` — zero precision loss, no intermediate Number). The two operator-console files instead do `Number(amount)` before formatting (`PayoutsClient.tsx`: `Number(amount).toLocaleString('vi-VN')`; `money/page.tsx`: `fmtVndNum` → `VND.format(Number(v))`), re-entering float domain at display time. Two sibling files, touched in the same commit, solved the identical "format a string-serialized BigInt" problem two different ways — one precision-safe, one not.
    Fix: standardize all four call sites on the `Intl.NumberFormat.format(bigint)` pattern already proven correct in the two admin pages; delete the `Number(...)` intermediate step in `PayoutsClient.tsx` and `money/page.tsx`.

  [DEPLOYMENT-TARGET COUPLING] lib/core/db/client.ts:14,19
    `DATABASE_POOL_MAX` default drops 5→1 and `connectionTimeoutMillis` triples 3000→10000, applied unconditionally through the single `prisma` singleton in `lib/core/db/client.ts`. That singleton is shared by every context that imports it: Vercel serverless request handlers, the persistent `pnpm dev` server (port 3001), the `pnpm vitest:int` integration-test runner, and every `lib/jobs/*` cron core. The 5→1 / Neon-pooler rationale is sound for serverless request handlers (matches the pre-existing `lib/config/env.ts` Zod default and the PgBouncer-handles-pooling comment already in that file) — but nothing in this PR differentiates it from the persistent-process contexts that share the same client. Confirmed via grep: `DATABASE_POOL_MAX` is not set in `.env.example`, any CI workflow, or `docker-compose.dev.yml`, so every environment now silently inherits pool=1 with no documented override path.
    Mitigated in practice today: `vitest.integration.config.ts` already sets `maxWorkers: 1` for an unrelated reason (shared-DB test races), and every `lib/jobs/*` core processes rows via sequential `for` loops against a single `tx` handle rather than concurrent `Promise.all` calls — so no concrete deadlock was found. But the risk class is real: any future code path that grabs the global `prisma` singleton from inside a `$transaction` callback instead of using the passed `tx` (exactly the anti-pattern CLAUDE.md's transaction rule exists to prevent) will now wait up to the new 10s timeout instead of grabbing a free connection from a pool of 5 — turning a silent transaction-isolation bug into a slow, generic timeout, with no error message pointing at the pool.
    Fix: either scope `DATABASE_POOL_MAX` per environment (explicit values in `.env.example` for dev/CI vs. relying on the `1` default only in the Vercel/Neon deploy env), or add a one-line comment in `client.ts` noting the pool is intentionally sized for serverless and that dev/CI performance sensitivity to pool=1 is a known, accepted tradeoff.

PRIORITY 3 — Track on roadmap:

  [REDUNDANT INDEX] prisma/schema.prisma:909-910 (LedgerEntry)
    The migration adds `@@index([operatorId, createdAt])` alongside the pre-existing `@@index([operatorId])`. The composite index's leading column already serves any query that filters on `operatorId` alone (B-tree leftmost-prefix), making the single-column index redundant — extra write/storage cost on every insert into an append-only, ever-growing table, with no read-path benefit. The same migration correctly recognized and removed the analogous case for `Operator.id` (redundant with the PK index) but didn't apply the same judgment here. Low urgency at current launch scale (1-2 operators), but cheap to fix now before the table grows.
    Fix: drop `@@index([operatorId])` on LedgerEntry in a follow-up migration once confirmed no query planner path specifically prefers the narrower index.

  [CONNECT-TIMEOUT WIDENING, ALL ENVIRONMENTS] lib/core/db/client.ts:19
    `connectionTimeoutMillis` 3000→10000 is a reasonable accommodation for Neon cold-start/autosuspend wake time in production, but it applies equally to local dev against the always-on docker-compose Postgres, where a genuine misconfiguration (wrong `DATABASE_URL`, DB container down) now takes 3x longer to surface as an error. Minor DX regression, not a correctness issue.

Positive notes (no action needed):
  - New indexes are well-targeted: `Trip(busId)` and `LedgerEntry(operatorId, createdAt)` map directly to existing query shapes (capacity/bus-overlap checks, paginated operator ledger reads). `Hold(status, expiresAt)` replacing `Hold(expiresAt)` was checked against every WHERE-clause consumer of `Hold.expiresAt` in the codebase (`expireHolds.ts`, `getTripOccupancy.ts`, `getTripDetails.ts`, `reassignBus.ts`, `holdRepo.ts`) — every one of them filters on `status='active'` alongside `expiresAt`, so the composite fully subsumes the dropped single-column index with no query-pattern regression.
  - `prisma/schema.prisma` and `migration.sql` are in exact parity for every index added/dropped (Issue 007 rule) — verified line-for-line.
  - All BigInt arithmetic in `calcPayout.ts` and the withdrawal/processPayouts paths uses `BigInt()` constructor calls only — no `1n` literal syntax, compliant with the ES2017-target constraint (Issue 016).
  - Zero new imports introduced by this PR (verified via diff) — no new cross-domain coupling, no dependency-flow or module-boundary changes. `lib/admin` → `lib/ledger` and `lib/jobs` → `lib/ledger` continue to go through the domain barrel; all intra-domain references stay deep-relative.
  - `lib/core/db/client.ts` deliberately reads `process.env` directly rather than through `lib/config`'s `getEnv()` — correct, since `lib/config` is a domain-level module and `lib/core` importing from it would be the reverse-dependency violation CLAUDE.md's dependency-flow rule prohibits.

SUMMARY: 0 P1, 3 P2, 2 P3

RECOMMENDED NEXT STEPS:
  → Decide and document one BigInt-boundary convention for Payout-derived DTOs (string always, or Number only for provably-bounded single-row values) and apply it to `getRevenueReport.ts`.
  → Align `PayoutsClient.tsx` / `money/page.tsx` formatting with the BigInt-preserving `Intl.NumberFormat` pattern already used in the two admin pages touched by this same PR.
  → Add an explicit comment (or `.env.example` entries) documenting that `DATABASE_POOL_MAX=1` is a serverless-tuned default and call out the tradeoff for dev/CI.
  → Follow-up migration to drop the now-redundant `LedgerEntry(operatorId)` single-column index.
