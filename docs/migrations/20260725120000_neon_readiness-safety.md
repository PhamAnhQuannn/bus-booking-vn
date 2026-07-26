---
migration: 20260725120000_neon_readiness
pr: 301
head: b4cd55f6
reviewed-date: 2026-07-26
verdict: GO-WITH-CAUTION
risk-band: 🟡 CAUTION
blocked-by: "#362, #363 — merge-order hold, not a migration defect"
---

# Migration Safety — `20260725120000_neon_readiness`

This is the artifact PR #301 is missing. Both migrations currently on master carry one
(`20260723120000_payment_event_orphan_bookingid-safety.md`,
`20260723180000_payment_event_orphan_receivedat_idx-safety.md`); this one — the most
invasive of the three — does not.

## Verified before writing this report

**Schema ↔ migration parity: PASS (executed, not inferred).** Replayed the PR's entire
migration directory into a clean shadow database and diffed the result against the PR's
`schema.prisma`:

```bash
SHADOW_DATABASE_URL=postgresql://…:5434/bbvn_shadow \
pnpm prisma migrate diff --from-migrations ./prisma/migrations --to-schema ./prisma/schema.prisma
# → No difference detected.
```

That single command proves three things at once: the migration SQL is valid and applies
cleanly to a fresh database; the four index changes agree exactly with the `@@index`
declarations (CLAUDE.md Issue 007 rule satisfied); and there is no DSL-vs-SQL drift.

> **CLI note — CLAUDE.md's recorded invocation is stale again.** The 2026-07-23 entry gives
> `--from-config-datasource --to-schema prisma/schema.prisma`, which diffs against a *live*
> database and therefore only works once the migration is already applied. For reviewing an
> **unapplied** migration the right form is `--from-migrations <dir> --to-schema <path>`.
> Also: `--shadow-database-url` is no longer a valid flag in Prisma 7.8 — it must come from
> `prisma.config.ts` / `SHADOW_DATABASE_URL` in the environment. Passing it prints the help
> text with no error message, which reads like a syntax mistake.

**Row counts.** Prod was not queried (no credentials in this session). Estimates below are
from the seeded dev database (`Trip` 1440, `Payout` 0, `Hold` 0, `LedgerEntry` 0,
`Operator` 3) plus documented Phase-1 scale — lenxevn.com launched July 2026 with 1–2 family
operators, ADR-007 sizes the target at ~200 bookings/day. Every table here is small.
**Re-check `Hold` and `LedgerEntry` before applying**; they are the two that grow fastest and
they are the two this migration write-locks.

## Statements

Prisma wraps `migration.sql` in a **single transaction**, so every lock below is acquired
and held until `COMMIT`. Individual durations are not what matters — see Lock Budget.

| # | Statement | Table | Risk | Lock | Est. duration |
|---|-----------|-------|------|------|----------------|
| 1 | `ALTER TABLE "Payout" ALTER COLUMN "gross" SET DATA TYPE BIGINT` | Payout (~0–10²) | 🟡 | ACCESS EXCLUSIVE | rewrite, <100 ms at this size |
| 2 | …`"platformFee"` | Payout | 🟡 | ACCESS EXCLUSIVE | 2nd full rewrite |
| 3 | …`"net"` | Payout | 🟡 | ACCESS EXCLUSIVE | 3rd full rewrite |
| 4 | …`"taxVat"` | Payout | 🟡 | ACCESS EXCLUSIVE | 4th full rewrite |
| 5 | …`"taxPit"` | Payout | 🟡 | ACCESS EXCLUSIVE | 5th full rewrite |
| 6 | …`"taxTotal"` | Payout | 🟡 | ACCESS EXCLUSIVE | 6th full rewrite |
| 7 | `CREATE INDEX "Trip_busId_idx" ON "Trip"("busId")` | Trip (~1.4k) | 🟡 | SHARE (blocks writes) | ~10 ms |
| 8 | `CREATE INDEX "LedgerEntry_operatorId_createdAt_idx"` | LedgerEntry (grows fast) | 🟡 | SHARE (blocks writes) | ~10 ms today |
| 9 | `DROP INDEX IF EXISTS "Hold_expiresAt_idx"` | Hold | 🟢 | ACCESS EXCLUSIVE | instant |
| 10 | `CREATE INDEX "Hold_status_expiresAt_idx" ON "Hold"("status","expiresAt")` | Hold (hot) | 🟡 | SHARE (blocks writes) | ~10 ms today |
| 11 | `DROP INDEX IF EXISTS "Operator_id_idx"` | Operator (3) | 🟢 | ACCESS EXCLUSIVE | instant |

Nothing here is 🔴. No `DROP TABLE`, no `DROP COLUMN`, no `SET NOT NULL`, no narrowing, no
new FK constraint, no in-migration `UPDATE`. All six type changes **widen**.

## Lock budget

**Single transaction ⇒ locks are cumulative, not sequential.** Statement 1 takes ACCESS
EXCLUSIVE on `Payout` and holds it until COMMIT. Statement 9 takes ACCESS EXCLUSIVE on
`Hold` and holds it until COMMIT — which means **every hold creation, and therefore the
entire booking funnel, is blocked from statement 9 through the end of the migration**, not
just for the duration of the index build. Same for `LedgerEntry` from statement 8, which
gates payment confirmation.

At current volumes the whole transaction is well under a second and this is academic. It
stops being academic when `Hold` and `LedgerEntry` reach six figures. Record the numbers
before applying.

### 🟡 The six-rewrite pattern

`integer → bigint` is **not binary-coercible** in Postgres (4-byte vs 8-byte on-disk
representation), so each `ALTER COLUMN … SET DATA TYPE BIGINT` forces a full table rewrite —
heap plus **all four** indices on `Payout` (PK, `tripId`, `(status, scheduledAt)`,
`(operatorId, status)`).

Six separate `ALTER TABLE` statements ⇒ **six full rewrites and twenty-four index rebuilds**
where one would do. Postgres coalesces multiple `ALTER COLUMN` clauses in a *single*
`ALTER TABLE` into one rewrite pass:

```sql
ALTER TABLE "Payout"
  ALTER COLUMN "gross"       SET DATA TYPE BIGINT,
  ALTER COLUMN "platformFee" SET DATA TYPE BIGINT,
  ALTER COLUMN "net"         SET DATA TYPE BIGINT,
  ALTER COLUMN "taxVat"      SET DATA TYPE BIGINT,
  ALTER COLUMN "taxPit"      SET DATA TYPE BIGINT,
  ALTER COLUMN "taxTotal"    SET DATA TYPE BIGINT;
```

6× less lock time, 6× less WAL, 6× less replica lag. **Costless to fix — this migration has
never been applied anywhere, so rewriting the file is not an edit to a committed migration.**
Do it before merge; afterwards it requires another migration and another lock window.

### `CREATE INDEX CONCURRENTLY` — deliberately not used

`CONCURRENTLY` cannot run inside a transaction, and Prisma wraps `migration.sql` in one. Using
it here would require splitting statements 7/8/10 out with `--create-only` and applying them
by hand — real operational complexity for tables that currently build in milliseconds.
**Accepting the lock is the correct call at this size.** Revisit when `Hold` or `LedgerEntry`
exceed ~1 M rows; at that point the index builds must be split out and run concurrently.

## Reverse migration

```sql
-- ── Index changes: fully reversible, cheap ────────────────────────────────
CREATE INDEX "Operator_id_idx" ON "Operator"("id");
DROP INDEX IF EXISTS "Hold_status_expiresAt_idx";
CREATE INDEX "Hold_expiresAt_idx" ON "Hold"("expiresAt");
DROP INDEX IF EXISTS "LedgerEntry_operatorId_createdAt_idx";
DROP INDEX IF EXISTS "Trip_busId_idx";

-- ── Type widening: ⚠️ CONDITIONALLY IRREVERSIBLE ──────────────────────────
-- GUARD FIRST. Must return 0, or the reversal aborts with "integer out of range":
--   SELECT count(*) FROM "Payout"
--    WHERE "gross" > 2147483647 OR "platformFee" > 2147483647 OR "net" > 2147483647
--       OR "taxVat" > 2147483647 OR "taxPit" > 2147483647 OR "taxTotal" > 2147483647;
ALTER TABLE "Payout"
  ALTER COLUMN "gross"       SET DATA TYPE INTEGER,
  ALTER COLUMN "platformFee" SET DATA TYPE INTEGER,
  ALTER COLUMN "net"         SET DATA TYPE INTEGER,
  ALTER COLUMN "taxVat"      SET DATA TYPE INTEGER,
  ALTER COLUMN "taxPit"      SET DATA TYPE INTEGER,
  ALTER COLUMN "taxTotal"    SET DATA TYPE INTEGER;
```

The guard is the whole point: the reversal becomes **permanently impossible** the moment a
single payout exceeds 2,147,483,647 VND (~$84K) — which is the exact scenario the migration
exists to enable. Past that point, rollback means restore-from-backup.

## Rollback stated the required way

CLAUDE.md 2026-07-24: *"state the rollback in terms of what the OTHER-version code does
against the migrated schema, not just the schema shape."* Three cases, and only one is safe:

**Case A — revert code AND migration together.** ✅ The only clean path. Safe iff the guard
query returns 0. Do this, or nothing.

**Case B — revert CODE only, leave the columns BIGINT.** ⚠️ **DANGEROUS — do not do this.**
master's `schema.prisma` declares `gross Int`, `net Int`, …. Through `@prisma/adapter-pg`,
node-postgres registers no `int8` parser by default, so BIGINT columns arrive as JavaScript
**strings** while Prisma's `Int` field expects a number. The failure lands on the payout
path — `processPayouts`, `retryPayout`, `getPayoutReport`, `getOperatorDetail` — as either a
deserialization error or a coerced value. This is a money-corruption shape, not a 500.

> The 2026-07-16 `pr-review-pr301` review reasoned about the schema shape alone and concluded
> *"Int→BigInt is backward-compatible (BigInt stores all Int values) … Standard rollback:
> forward migration to revert."* True of Case A, and it reads as reassurance about Case B —
> which is the dangerous one. This is the same failure mode as the #324 entry the mistake log
> was written from: a rollback plan described in terms of schema shape, hiding what the other
> version's code does against it.

**Case C — revert MIGRATION only, keep the BigInt code.** ❌ Broken. `processPayouts` passes
`-payout.net` into `appendLedgerEntry`'s bigint `amountMinor`; `calcPayout` does
`grossBig - platformFee`. With `Int` columns those become number/bigint mixes — a runtime
`TypeError: Cannot mix BigInt and other types`.

**Deploy-skew window (Case B in miniature).** `prisma migrate deploy` runs before the Vercel
cutover completes, so for a few seconds the prior deployment's in-flight requests — and any
cron invocation that fires in that gap — execute old code against the new schema. Exposure is
small here (payout traffic is cron-driven, not user-driven) but it is nonzero and it lands on
the money path.
→ Apply during a low-traffic window and confirm no payout cron fires mid-deploy.

## Verdict: 🟡 GO-WITH-CAUTION

The migration is **correct**. Parity is verified by execution, every type change widens,
nothing is destructive, and at current data volumes every lock is sub-second. On its own
technical merits this would be a clean GO.

The caution is procedural, and it is not about the SQL:

1. **Held on #362 + #363.** Not a migration defect — `lib/core/db/client.ts` ships in the
   same PR and flips the prod pool to `max: 1` against a still-blocking
   `pg_advisory_xact_lock` in `createHold`. Merge order is #362 → #363 → #301.
2. **Merge the six `ALTER TABLE`s into one.** Free now, costs a migration later.
3. **This document did not exist.** It is the artifact that would have caught the inverted
   Case-B rollback claim ten days ago.

## Pre-deploy checklist

- [ ] Backup / PITR confirmed within the last hour
- [ ] Guard query run and recorded: `SELECT count(*) FROM "Payout" WHERE … > 2147483647` → **0**
- [ ] Prod row counts recorded for `Hold` and `LedgerEntry` (the two write-locked hot tables)
- [ ] Six `ALTER TABLE` statements merged into one (see above)
- [ ] **#362 merged** — `pg_try_advisory_xact_lock` + bounded backoff in `createHold`
- [ ] **#363 merged** — `client.ts` reads `getEnv().DATABASE_POOL_MAX`
- [ ] `DATABASE_POOL_MAX=5` confirmed present in `.env.example` and all three DB-backed CI
      jobs (integration-tests, e2e-tests, flaky-e2e) — verified present at b4cd55f6
- [ ] Prod env confirmed to have **no** `DATABASE_POOL_MAX` set (prod is the only context
      that should fall through to the default)
- [ ] Applied in a low-traffic window; no payout cron scheduled inside the deploy gap
- [ ] PR body rewritten against the final diff — it still names the pre-rebase migration
      `20260715010000_neon_readiness`, which does not exist
- [ ] This document linked from the PR body

## Auto-chain

- After apply → `/deploy-health-gate` for a 30-minute window. Watch `/api/health` latency
  specifically: it shares the same single connection, so its p99 is the earliest indicator
  of pool starvation.
- No backfill script needed — widening requires none.
- After successful prod apply → archive this doc under `docs/migrations/applied/`.
