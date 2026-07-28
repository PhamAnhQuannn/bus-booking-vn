# Rollback — Neon readiness + bounded hold lock

Covers the release bundling **#362** (bounded trip lock), **#363** (pool split-brain),
**#364** (payout claim limit) and the absorbed **PR #301** (Payout `Int→BigInt`, index
changes, `pool=1`).

Written per the 2026-07-24 rule: state the rollback in terms of what the **other version's
code** does against the **migrated schema**, not just the schema shape. "Revert the code,
leave the column" is how a nullable column re-armed the wrong-payee bug.

## Why these could not ship separately

`createHold` used to take its advisory locks with the **blocking**
`pg_advisory_xact_lock`. PR #301 changes the pool default from 5 to 1. At `pool=1` a
single blocked hold leaves the warm instance with **zero** free connections, so the
instance serves nothing until `connectionTimeoutMillis`. Shipping #301 alone converts a
degraded path into a per-instance outage. The bounded locks are what make `pool=1` safe.

All **three** locks — session, phone, trip — are try-locks, and the claim above is only
true because of that. Advisory locks are global while the pool is per-instance, so the
outage shape needs just one contended key held by another instance; it does not care
which key. An earlier draft bounded only the trip lock, on the reasoning that session and
phone are per-caller. Phase 1 has no customer auth, so `customerPhone` is attacker-chosen
and `bb_sid` is an unsigned client-mintable cookie — leaving either blocking would have
left the same outage reachable through a key an attacker picks, and this document's claim
would have been true only of trip contention. The invariant to preserve on any future
edit: **no request holds a pooled connection while waiting for a lock.**

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
- The `Payout` columns are wider than the old code expects. Every VALUE written during
  the rolled-forward window still fits in `INT4` — nothing in the payout path can produce
  a VND amount near 2^31 — so no data is lost by reverting the code.

  **Not verified: whether the old Prisma client can READ an `int8` column it declares as
  `Int`.** Prisma deserialises against its own generated schema, so a widened column is a
  client/DB type mismatch, and it may throw rather than coerce. Nobody has run it. Do NOT
  discover this during an incident — before relying on this path, point a build of the
  previous commit at a migrated database and run one payout read:

  ```
  pnpm prisma generate && node -e "require('./lib/core/db/client').prisma.payout.findFirst().then(console.log)"
  ```

  If it throws, the code-only revert is not available and you are in the
  "schema must also be rolled back" path below. This bullet exists because an earlier
  draft asserted the read was safe without anyone having tried it.
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
