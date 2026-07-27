# Rollback — Neon readiness + bounded hold lock

Covers the release bundling **#362** (bounded trip lock), **#363** (pool split-brain),
**#364** (payout claim limit) and the absorbed **PR #301** (Payout `Int→BigInt`, index
changes, `pool=1`).

Written per the 2026-07-24 rule: state the rollback in terms of what the **other version's
code** does against the **migrated schema**, not just the schema shape. "Revert the code,
leave the column" is how a nullable column re-armed the wrong-payee bug.

## Why these could not ship separately

`createHold` used to take the trip advisory lock with the **blocking**
`pg_advisory_xact_lock`. PR #301 changes the pool default from 5 to 1. At `pool=1` a
single blocked hold leaves the warm instance with **zero** free connections, so the
instance serves nothing until `connectionTimeoutMillis`. Shipping #301 alone converts a
degraded path into a per-instance outage. The bounded lock is what makes `pool=1` safe.

**Therefore: never revert the lock change while leaving `pool=1` deployed.** That
combination is strictly worse than either version alone and is the one ordering that must
not happen.

## Migrations in this release

| Migration | Effect | Reversible? |
|---|---|---|
| `20260725120000_neon_readiness` | `Payout.gross/platformFee/net/taxVat/taxPit/taxTotal` `INT → BIGINT`; add `Trip_busId_idx`, `LedgerEntry_operatorId_createdAt_idx`; drop `Hold_expiresAt_idx` → `Hold_status_expiresAt_idx`; drop `Operator_id_idx` | widening only — see below |
| `20260726120000_hold_session_seat_cap` | add nullable `Hold.sessionId` + index | additive |

`INT → BIGINT` is a **widening** conversion. Postgres rewrites the column but no value is
lost, and the reverse (`BIGINT → INT`) would fail on any row exceeding 2³¹−1. In practice
VND payouts do not approach that, but the reverse migration is still not safe to run
blind.

## Rollback procedure

### Preferred: revert the code, keep the schema

Both migrations are **forward-compatible with the previous code**:

- `Hold.sessionId` is nullable; pre-#359 code never writes or reads it. Rows created
  during the rolled-back window simply have `NULL`, which the seat cap treats as "no
  session to attribute" if the code is rolled forward again.
- The `Payout` columns are wider than the old code expects. The old code reads them as
  JS `number` via Prisma — safe for any realistic VND value, and it never writes a value
  that would not have fit in `INT` anyway.
- Index changes are transparent to both versions. Dropping `Hold_expiresAt_idx` in favour
  of `Hold_status_expiresAt_idx` only affects plan choice; the sweeper's query filters on
  both columns, so the composite serves it strictly better.

**Critical ordering:** if you revert the application code, you MUST also revert
`DATABASE_POOL_MAX` to a value `> 1` (5 matches the historical behaviour) in Vercel
Production **before or with** the code revert. The old code has the blocking lock; leaving
`pool=1` under it is the outage described above.

### If the schema must also be rolled back

Only the index changes should be reversed, and only if a plan regression is proven:

```sql
CREATE INDEX IF NOT EXISTS "Hold_expiresAt_idx" ON "Hold" ("expiresAt");
DROP INDEX IF EXISTS "Hold_sessionId_status_expiresAt_idx";
ALTER TABLE "Hold" DROP COLUMN IF EXISTS "sessionId";
```

Do **not** narrow the `Payout` columns back to `INT`. There is no operational reason to,
and it fails on overflow. Committed migrations are never edited — write a forward
migration if a reversal is genuinely required.

## Verification after rollback

- `pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`
  → `No difference detected.`
- Create a hold end-to-end; confirm it succeeds and the bb_hold cookie is set.
- Confirm `DATABASE_POOL_MAX` in Vercel Production matches the deployed code's lock
  strategy (blocking → >1, bounded try-lock → 1).
- Run one payout cron tick and confirm `payout_debit` ledger entries still balance.
