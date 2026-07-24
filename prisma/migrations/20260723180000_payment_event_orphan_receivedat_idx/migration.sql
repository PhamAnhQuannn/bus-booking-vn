-- Bug B follow-up: index the orphan-payment scan.
--
-- For every stuck booking it examines (up to CLAIM_LIMIT = 200 per tick), the
-- reconcile sweeper runs:
--     WHERE pe."bookingId" IS NULL
--       AND pe."receivedAt" BETWEEN <anchor - 30min> AND <anchor + 30min>
--
-- `bookingId IS NULL` can use the existing PaymentEvent_bookingId_idx btree (PG
-- indexes NULLs), but `receivedAt` cannot participate in that index, so it becomes
-- a heap recheck applied to EVERY orphan row fetched. Cost is therefore
-- O(total orphans) per candidate booking, independent of how narrow the window is.
--
-- That set grows without bound: SePay notifies on EVERY credit to the receiving
-- account, not only ticket payments, and the adapter's gate before recording an
-- unmatched row is just `transferType = 'in'` + positive amount. Ordinary business
-- deposits therefore accumulate as orphans, and nothing prunes them (they are the
-- only evidence unclaimed customer money arrived, so they must not be auto-deleted).
--
-- A partial index keeps the scan proportional to the time window instead of to the
-- whole table, and only indexes the orphan subset — a few hundred KB. Added now,
-- while the table is effectively empty, because building it later on a large table
-- would need CREATE INDEX CONCURRENTLY outside a transaction.
--
-- SQL-only by necessity: Prisma's DSL cannot express a WHERE-clause partial index,
-- so this stays out of schema.prisma and Prisma correctly ignores it when diffing
-- (verified: `prisma migrate diff --from-config-datasource --to-schema
-- prisma/schema.prisma` reports no difference).
CREATE INDEX "PaymentEvent_orphan_receivedAt_idx"
  ON "PaymentEvent" ("receivedAt")
  WHERE "bookingId" IS NULL;
