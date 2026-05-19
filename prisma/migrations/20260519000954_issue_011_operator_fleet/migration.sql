-- Issue 011 — Operator Fleet Management
-- Hand-patched migration. 14-block order honoring nullable-add → backfill →
-- NOT NULL gate (Issue 010 Mistake Log fail-fast rule). Bus.operatorId already
-- exists from the init migration — only OperatorUser.operatorId is new.

-- Block 1 — Create BusType enum
CREATE TYPE "BusType" AS ENUM ('coach', 'sleeper', 'limousine');

-- Block 2 — Add new Bus columns (nullable for now; busType backfilled below)
ALTER TABLE "Bus"
  ADD COLUMN "busType" "BusType",
  ADD COLUMN "deactivatedAt" TIMESTAMP(3);

-- Block 3 — Rename plateNumber → licensePlate (preserves data)
ALTER TABLE "Bus" RENAME COLUMN "plateNumber" TO "licensePlate";

-- Block 4 — Drop the old single-column unique index on plateNumber
DROP INDEX "Bus_plateNumber_key";

-- Block 5 — Create BusMaintenance table
CREATE TABLE "BusMaintenance" (
  "id" TEXT NOT NULL,
  "busId" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusMaintenance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusMaintenance_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Block 6 — BusMaintenance index
CREATE INDEX "BusMaintenance_busId_idx" ON "BusMaintenance"("busId");

-- Block 7 — Add OperatorUser.operatorId (nullable for backfill)
ALTER TABLE "OperatorUser" ADD COLUMN "operatorId" TEXT;

-- Block 8 — Backfill: every existing Bus gets busType='coach'.
--           Bus.operatorId already populated from init migration (no work needed).
UPDATE "Bus" SET "busType" = 'coach' WHERE "busType" IS NULL;

-- Block 9 — Backfill OperatorUser.operatorId to the first available Operator.
--           Single-tenant dev data: 1 operator user, multiple operators — assign
--           to the most-recently-created operator (matches seed flow where
--           OperatorUser is created after Operators).
UPDATE "OperatorUser"
  SET "operatorId" = (SELECT id FROM "Operator" ORDER BY "createdAt" ASC LIMIT 1)
  WHERE "operatorId" IS NULL;

-- Block 10 — NULL-count fail-fast gate (Issue 010 Mistake Log rule).
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "Bus" WHERE "busType" IS NULL) > 0 THEN
    RAISE EXCEPTION 'Bus busType backfill incomplete';
  END IF;
  IF (SELECT COUNT(*) FROM "OperatorUser" WHERE "operatorId" IS NULL) > 0 THEN
    RAISE EXCEPTION 'OperatorUser.operatorId backfill incomplete';
  END IF;
END $$;

-- Block 11 — Promote Bus.busType to NOT NULL
ALTER TABLE "Bus" ALTER COLUMN "busType" SET NOT NULL;

-- Block 12 — Promote OperatorUser.operatorId to NOT NULL
ALTER TABLE "OperatorUser" ALTER COLUMN "operatorId" SET NOT NULL;

-- Block 13 — Add FK on OperatorUser.operatorId → Operator.id (RESTRICT delete)
ALTER TABLE "OperatorUser"
  ADD CONSTRAINT "OperatorUser_operatorId_fkey"
  FOREIGN KEY ("operatorId") REFERENCES "Operator"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Block 14 — Composite unique on (operatorId, licensePlate) + partial active-only index.
--   The partial WHERE-clause index stays SQL-only (Prisma DSL can't model partials).
--   Drop the legacy plain `Bus_operatorId_idx` — superseded by the partial
--   active index + the new composite (operatorId, licensePlate) unique.
DROP INDEX "Bus_operatorId_idx";
CREATE UNIQUE INDEX "Bus_operatorId_licensePlate_key" ON "Bus"("operatorId", "licensePlate");
CREATE INDEX "Bus_operatorId_active_idx" ON "Bus"("operatorId") WHERE "deactivatedAt" IS NULL;

-- Index on OperatorUser.operatorId (declared in schema.prisma too — see Mistake Log Issue 007).
CREATE INDEX "OperatorUser_operatorId_idx" ON "OperatorUser"("operatorId");
