PERF REVIEW — PR #301 "feat(ledger): migrate Payout to BigInt + Neon index readiness" @ f66a1caf
─────────────────────────────

Scope verified against the actual merged tree (`f66a1caf`, present on `master`/`feat/payout-bigint-neon`), not just the pasted diff: `prisma/migrations/20260715010000_neon_readiness/migration.sql`, `prisma/schema.prisma`, `lib/core/db/client.ts`, and all BigInt consumer sites (`calcPayout.ts`, `withdrawal.ts`, `getPayoutReport.ts`, `getRevenueReport.ts`, `settlePayout.ts`, `processPayouts.ts`, `getPayoutQueue.ts`, `getOperatorDetail.ts`).

Business-scale context pulled from `ADR-002-nfr-targets` and `ADR-020-deployment` (both cited inline below): Phase 1 = ~200 bookings/day, 1-2 family operators, Vercel Pro (sin1) + Neon Launch is the *sole* production stack (D7). This materially changes the severity calibration below — several patterns that would be P1 at scale are P2/P3 today because the tables involved (`Payout`, `Trip`, `Hold`, `LedgerEntry`) are small.

─────────────────────────────
P1 — NONE

No production-incident-risk findings. The `Payout` table rewrite (int4→int8, not binary-coercible, forces a full `ACCESS EXCLUSIVE`-locked table rewrite per Postgres semantics) is real, but at Phase 1 volume (a handful of payouts/day across 1-2 operators) the table is on the order of hundreds to low-thousands of rows — the rewrite completes in milliseconds. Deploys are atomic on Vercel (build + `migrate deploy` before traffic cutover), so there is no code/schema version-skew window to worry about either. See P2-1/P2-3 below for the compounding mechanism that would turn this into a P1 at 10-50x current volume.

─────────────────────────────
P2 — MEASURABLE DEGRADATION

**P2-1. `DATABASE_POOL_MAX` fallback dropped 5→1 defeats the codebase's own `Promise.all([prisma.x, prisma.y, ...])` fan-out pattern.**
`lib/core/db/client.ts:14` now falls back to `max: 1` (matching the Zod default in `lib/config/env.ts:303`, which was already 1 — this PR just made the two consistent). Grep of `lib/**` shows this fan-out pattern is used pervasively for dashboard/report reads that issue 2-4 independent `prisma.x.count()`/`findMany()` calls inside one `Promise.all`:
- `lib/home/getHomeMetrics.ts` (public home page — every visitor)
- `lib/admin/getActionQueue.ts`, `lib/admin/getFailureAlerts.ts`, `lib/admin/getLedgerView.ts`, `lib/admin/getModerationQueue.ts`, `lib/admin/getOperatorDetail.ts`
- `lib/op/getTodaySnapshot.ts`, `lib/analytics/getAdminMetrics.ts`

With `max: 1`, a single `pg.Pool` connection serves one request at a time per warm serverless instance. `Promise.all` still fires all N queries concurrently at the JS level, but node-postgres queues them for the one physical connection — so instead of N queries completing in `max(t1..tN)`, they now complete in `sum(t1..tN)`. This is a real, silent latency regression on every one of the endpoints above, including the public home page. It happens to be correct/intentional for Vercel's one-request-per-invocation model (Neon's own pooler handles cross-invocation concurrency), but it should be a deliberate, documented trade-off — not an incidental side effect of aligning a fallback constant, since it directly undoes the parallelism the `Promise.all` call sites were written to get.
*Recommendation*: note the intentional serialization in a comment on `createPrismaClient()`, and consider whether the 2-4 count queries in the hot-path `getHomeMetrics`/`getActionQueue` should be collapsed into one `$queryRaw` (multiple `COUNT(*) FILTER (WHERE ...)` in a single round trip) rather than relying on pool-level concurrency at all.

**P2-2. `connectionTimeoutMillis` 3s→10s compounds P2-1's serialization under contention.**
Because `max: 1`, any request whose single connection is occupied by a slow/blocked query forces every other concurrent request on that same warm instance to wait for a free connection. Previously that wait failed fast after 3s; now it hangs for up to 10s before erroring. This directly elongates the perceived-outage window for the exact scenario this PR introduces (see P2-3): a live write blocked behind a migration-held table lock now ties up request threads 3.3x longer before failing. If there's a reason for the longer timeout (e.g. Neon cold-start/autoscale latency), say so in a comment — as written it reads as a blanket increase with no stated rationale, stacked on top of a pool-exhaustion-prone `max: 1`.

**P2-3. Six separate `ALTER COLUMN ... SET DATA TYPE BIGINT` statements instead of one.**
`migration.sql` lines 2-7 issue six distinct `ALTER TABLE "Payout" ALTER COLUMN "<col>" SET DATA TYPE BIGINT;` statements. Postgres cannot binary-coerce int4→int8 (different byte width), so **each** statement is its own full-table rewrite + `ACCESS EXCLUSIVE` lock acquisition/release, even though they all target the same table in the same migration transaction. Combining them into one statement —
```sql
ALTER TABLE "Payout"
  ALTER COLUMN "gross" SET DATA TYPE BIGINT,
  ALTER COLUMN "platformFee" SET DATA TYPE BIGINT,
  ALTER COLUMN "net" SET DATA TYPE BIGINT,
  ALTER COLUMN "taxVat" SET DATA TYPE BIGINT,
  ALTER COLUMN "taxPit" SET DATA TYPE BIGINT,
  ALTER COLUMN "taxTotal" SET DATA TYPE BIGINT;
```
— makes Postgres do exactly one rewrite pass instead of six. At Phase 1 row counts the difference is milliseconds and not worth a follow-up migration by itself, but it's the kind of pattern that turns into real deploy-time lock contention once `Payout` grows past the low-thousands (Phase 2/3, per the same `ADR-002` Tet-surge scale-up the migration's own name — "neon_readiness" — is preparing for). Fix it the next time this migration file is touched; committed migrations aren't edited per project rule.

**P2-4. `LedgerEntry_operatorId_idx` is now fully redundant and was left in place.**
`prisma/schema.prisma` (LedgerEntry model) keeps both `@@index([operatorId])` and the new `@@index([operatorId, createdAt])`. Postgres serves any equality-only lookup on `operatorId` from the leading column of the composite index — the single-column index adds no query-plan value and only costs write amplification (one more btree entry maintained per `INSERT`) and disk. This is the *exact* cleanup this PR performed for `Operator.id` (removed because "PK already indexed," migration line 20) but missed for `LedgerEntry.operatorId`. It matters more here than the Operator case: `LedgerEntry` is explicitly append-only and grows without bound (every paid booking / payout / chargeback appends a row — see the project's "LedgerEntry append-only" rule), so this redundant index's overhead compounds forever, unlike `Payout`'s bounded growth.
*Fix*: drop `@@index([operatorId])` from the `LedgerEntry` model + a `DROP INDEX` in a follow-up migration.

**P2-5. Non-concurrent `CREATE INDEX`/`DROP INDEX` on `Trip`/`Hold`/`LedgerEntry` share the migration's one transaction with the `Payout` rewrites.**
Prisma runs `migration.sql` as a single transaction (no `CONCURRENTLY` statements present, so nothing forces a split). All locks acquired by the six `ALTER COLUMN` rewrites, the two `Trip`/`LedgerEntry` `CREATE INDEX`, and the `Hold` `DROP INDEX`/`CREATE INDEX` pair are held until the transaction commits — so, e.g., a live seat-hold write against `Hold` during this migration blocks not just for its own (fast) index rebuild, but for the full duration of everything ahead of it in the script. Fine at ~200 bookings/day; `ADR-002-nfr-targets` already flags `Hold` specifically as the table that saturates under Tet-surge load (500 bookings/day × 20x). When traffic approaches that regime, switch non-concurrent index builds on `Hold` to `CREATE INDEX CONCURRENTLY` in their own non-transactional migration step (`migration_lock.toml` / manual split) rather than bundling them with unrelated `Payout` DDL.

─────────────────────────────
P3 — MINOR OPTIMIZATION OPPORTUNITY

**P3-1. `Trip_busId_idx` is single-column; the actual consumer filters on more.**
`lib/trips/busOverlap.ts` (the capacity-guard / bus-overlap check the migration comment cites) runs `WHERE t."busId" = ? AND t.status IN ('scheduled','departed') AND <departureAt window>`. A composite `@@index([busId, status, departureAt])` would let this query be answered from the index alone instead of an index scan on `busId` followed by a residual filter. Not worth a migration today — trips per bus are a handful at Phase 1 — but worth it if `Trip` volume grows enough that per-bus row counts stop being trivial.

**P3-2. Int→BigInt byte-width impact confirmed benign at current scale.**
24 extra bytes/row (4→8 bytes × 6 columns) on `Payout`, well-aligned (six consecutive 8-byte columns need no extra padding). At Phase 1 row counts this is a sub-megabyte total delta to table + index size — no measurable buffer-cache or I/O impact. Closing this out explicitly since it was a named review-focus item: verified non-issue, no action needed.

**P3-3. Local dev / CI e2e inherits `max: 1` with no override documented.**
`.env.example` does not set `DATABASE_POOL_MAX`, so `pnpm dev` (one persistent Node process) and parallel Playwright e2e workers all hitting that one dev server now share a single DB connection by default — previously 5. This mirrors P2-1's serialization but in a context where it costs wall-clock CI/local time rather than user-facing latency. Consider documenting a `DATABASE_POOL_MAX=5`-or-higher override for local dev in `SI-002-dev-environment`, distinct from the intentional production `max: 1`.

**P3-4. Hold index redesign (`status, expiresAt`) is well-matched — noted as a positive, not a gap.**
`lib/jobs/expireHolds.ts` runs `WHERE status = 'active' AND "expiresAt" < NOW()` — exactly the new `@@index([status, expiresAt])` composite. Good index design; no action needed. Flagging only because review-focus item #3 asked for missing/redundant index coverage and this one specifically checks out clean.

─────────────────────────────
SUMMARY: 0 P1, 5 P2, 4 P3
