-- Issue 050 Part A: PayoutStatus enum value rename to the spec-target vocabulary.
--
--   pending  -> requested   (a payout has been requested / scheduled, not yet swept)
--   settled  -> paid        (the payout has been disbursed)
--
-- 'processing' and 'failed' are unchanged.
--
-- Postgres 12+ supports ALTER TYPE ... RENAME VALUE as an in-place catalog
-- update: it rewrites NO table rows (the on-disk enum ordinal is unchanged, only
-- the label is renamed), so this is O(1) and safe on a large Payout table.
--
-- NOTE: RENAME VALUE cannot run inside a transaction block alongside other
-- enum-altering statements in some PG versions, but each statement here is an
-- independent catalog op and Prisma runs migration files statement-by-statement.
ALTER TYPE "PayoutStatus" RENAME VALUE 'pending' TO 'requested';
ALTER TYPE "PayoutStatus" RENAME VALUE 'settled' TO 'paid';

-- Re-point the column default to the renamed 'requested' value. (The old default
-- text 'pending' no longer exists as a label after the rename above.)
ALTER TABLE "Payout" ALTER COLUMN "status" SET DEFAULT 'requested';
