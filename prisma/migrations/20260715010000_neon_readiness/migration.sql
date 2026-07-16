-- P0-2: Payout money columns Int -> BigInt (overflow risk on withdrawal aggregates)
ALTER TABLE "Payout" ALTER COLUMN "gross" SET DATA TYPE BIGINT;
ALTER TABLE "Payout" ALTER COLUMN "platformFee" SET DATA TYPE BIGINT;
ALTER TABLE "Payout" ALTER COLUMN "net" SET DATA TYPE BIGINT;
ALTER TABLE "Payout" ALTER COLUMN "taxVat" SET DATA TYPE BIGINT;
ALTER TABLE "Payout" ALTER COLUMN "taxPit" SET DATA TYPE BIGINT;
ALTER TABLE "Payout" ALTER COLUMN "taxTotal" SET DATA TYPE BIGINT;

-- P1-1: Trip.busId index (capacity-guard + bus-overlap queries)
CREATE INDEX "Trip_busId_idx" ON "Trip"("busId");

-- P1-2: LedgerEntry (operatorId, createdAt) for paginated operator reads
CREATE INDEX "LedgerEntry_operatorId_createdAt_idx" ON "LedgerEntry"("operatorId", "createdAt");

-- P1-3: Hold sweeper index — include status for cron WHERE status='active' AND expiresAt < NOW()
DROP INDEX IF EXISTS "Hold_expiresAt_idx";
CREATE INDEX "Hold_status_expiresAt_idx" ON "Hold"("status", "expiresAt");

-- P1-6: Drop redundant Operator.id index (PK already indexed)
DROP INDEX IF EXISTS "Operator_id_idx";
