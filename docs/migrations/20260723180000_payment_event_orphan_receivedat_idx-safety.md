---
migration: 20260723180000_payment_event_orphan_receivedat_idx
reviewed-date: 2026-07-24
verdict: GO
risk-band: 🟢 SAFE
pr: "#324"
---

# Migration Safety — `20260723180000_payment_event_orphan_receivedat_idx`

Single-statement migration adding a partial index for the reconcile sweeper's orphan scan.
Companion to `20260723120000_payment_event_orphan_bookingid` (nullable `bookingId`) in the
same PR.

## Statement

| # | Statement | Table | Risk | Lock | Est. duration |
|---|-----------|-------|------|------|----------------|
| 1 | `CREATE INDEX "PaymentEvent_orphan_receivedAt_idx" ON "PaymentEvent"("receivedAt") WHERE "bookingId" IS NULL` | PaymentEvent (~0 rows prod) | 🟢 SAFE | SHARE (blocks writes for build duration) | sub-second at launch scale |

## Verdict: 🟢 GO

`CREATE INDEX` (non-`CONCURRENTLY`) takes a `SHARE` lock that blocks writes to
`PaymentEvent` for the build duration. On PG16 at launch scale the table is effectively
empty (bank transfer went live 2026-07-22; almost nothing was ever written), so the build
is sub-second and the write-block is immaterial. The partial predicate (`WHERE "bookingId"
IS NULL`) means the index only ever covers the orphan subset — a few hundred KB even as the
table grows.

## Why now, not later

The index is added while the table is small **on purpose**: building it later on a large
`PaymentEvent` would need `CREATE INDEX CONCURRENTLY`, which cannot run inside a Prisma
migration transaction and would require a `--create-only` + manual-apply split. Adding it
now avoids that entirely.

## Prisma DSL / drift

A `WHERE`-clause partial index cannot be expressed in the Prisma schema DSL, so this stays
SQL-only and is correctly absent from `schema.prisma`. Verified no drift:

```
$ pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
No difference detected.
```

## Reverse

`DROP INDEX "PaymentEvent_orphan_receivedAt_idx";` — clean, non-destructive, no data
implications. Unlike the companion `bookingId` migration, dropping this index is safe and
harmless (it only reverts the sweeper's orphan scan to a heap recheck).

## Ordering

Must run after `20260723120000` (the column must be nullable before an index predicated on
`bookingId IS NULL` is meaningful). Prisma applies migrations in timestamp order, so this is
automatic.
