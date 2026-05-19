-- Issue 012: Route operator scoping + PickupPoint model
-- Executed inside a single implicit transaction by Prisma migration runner.

-- Block 1: Add operatorId column (nullable first for backfill)
ALTER TABLE "Route" ADD COLUMN "operatorId" TEXT;

-- Block 2: Add durationMinutes column (nullable first for backfill)
ALTER TABLE "Route" ADD COLUMN "durationMinutes" INTEGER;

-- Block 3: Add deactivatedAt column
ALTER TABLE "Route" ADD COLUMN "deactivatedAt" TIMESTAMP(3);

-- Block 4: Add updatedAt column with temporary default NOW() for backfill; default dropped below
ALTER TABLE "Route" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Block 5: Backfill operatorId + durationMinutes
-- Try to derive operatorId from linked Trip → Bus → Operator
UPDATE "Route"
SET "operatorId" = (
  SELECT b."operatorId"
  FROM "Trip" t
  JOIN "Bus" b ON t."busId" = b."id"
  WHERE t."routeId" = "Route"."id"
  LIMIT 1
)
WHERE "operatorId" IS NULL;

-- Fallback: assign to first operator if no trips link to route
UPDATE "Route"
SET "operatorId" = (SELECT "id" FROM "Operator" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "operatorId" IS NULL;

-- Default durationMinutes to 240 (4 hours)
UPDATE "Route"
SET "durationMinutes" = 240
WHERE "durationMinutes" IS NULL;

-- Block 6: Make columns NOT NULL now that backfill is done
ALTER TABLE "Route" ALTER COLUMN "operatorId" SET NOT NULL;
ALTER TABLE "Route" ALTER COLUMN "durationMinutes" SET NOT NULL;

-- Block 7: FK + non-partial indices on Route
ALTER TABLE "Route"
  ADD CONSTRAINT "Route_operatorId_fkey"
  FOREIGN KEY ("operatorId") REFERENCES "Operator"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Route_operatorId_idx" ON "Route"("operatorId");

-- Partial index (WHERE clause) — stays SQL-only, not in Prisma DSL
CREATE INDEX "Route_operatorId_deactivatedAt_idx" ON "Route"("operatorId")
  WHERE "deactivatedAt" IS NULL;

-- Block 8: Create PickupPoint table
CREATE TABLE "PickupPoint" (
  "id"            TEXT NOT NULL,
  "routeId"       TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "address"       TEXT NOT NULL,
  "displayOrder"  INTEGER NOT NULL,
  "deactivatedAt" TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PickupPoint_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PickupPoint"
  ADD CONSTRAINT "PickupPoint_routeId_fkey"
  FOREIGN KEY ("routeId") REFERENCES "Route"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PickupPoint_routeId_displayOrder_idx" ON "PickupPoint"("routeId", "displayOrder");

-- Partial index (WHERE clause) — stays SQL-only, not in Prisma DSL
CREATE INDEX "PickupPoint_routeId_deactivatedAt_idx" ON "PickupPoint"("routeId")
  WHERE "deactivatedAt" IS NULL;

-- Drop temporary DB-level defaults from @updatedAt columns (Prisma manages updatedAt in the client)
ALTER TABLE "Route" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PickupPoint" ALTER COLUMN "updatedAt" DROP DEFAULT;
