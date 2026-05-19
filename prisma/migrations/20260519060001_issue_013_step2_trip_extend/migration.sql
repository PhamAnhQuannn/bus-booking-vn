-- Issue 013 Step 2: Extend Trip table with operator scoping + lifecycle columns
-- Single atomic migration: ADD nullable columns → backfill → SET NOT NULL → FKs → indices

-- Block 1: Add nullable columns to Trip
ALTER TABLE "Trip" ADD COLUMN "operatorId"           TEXT;
ALTER TABLE "Trip" ADD COLUMN "cancelReason"         TEXT;
ALTER TABLE "Trip" ADD COLUMN "cancelledAt"          TIMESTAMP(3);
ALTER TABLE "Trip" ADD COLUMN "recurringTemplateId"  TEXT;
ALTER TABLE "Trip" ADD COLUMN "pairedTripId"         TEXT;
ALTER TABLE "Trip" ADD COLUMN "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Block 2: Backfill operatorId from linked Route → operatorId (Route already has this column)
UPDATE "Trip"
SET "operatorId" = r."operatorId"
FROM "Route" r
WHERE "Trip"."routeId" = r."id"
  AND "Trip"."operatorId" IS NULL;

-- Fallback: assign to first operator if Route has no operatorId (shouldn't happen post-012)
UPDATE "Trip"
SET "operatorId" = (SELECT "id" FROM "Operator" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "operatorId" IS NULL;

-- Block 3: Make operatorId NOT NULL now that backfill is done
ALTER TABLE "Trip" ALTER COLUMN "operatorId" SET NOT NULL;

-- Block 4: Add FKs
ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_operatorId_fkey"
  FOREIGN KEY ("operatorId") REFERENCES "Operator"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_recurringTemplateId_fkey"
  FOREIGN KEY ("recurringTemplateId") REFERENCES "RecurringTripTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Self-referential pairedTripId FK
ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_pairedTripId_fkey"
  FOREIGN KEY ("pairedTripId") REFERENCES "Trip"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Block 5: Add non-partial indices (declared in schema.prisma @@index as well)
CREATE INDEX "Trip_operatorId_idx" ON "Trip"("operatorId");
CREATE INDEX "Trip_recurringTemplateId_idx" ON "Trip"("recurringTemplateId");
CREATE INDEX "Trip_pairedTripId_idx" ON "Trip"("pairedTripId");

-- Block 6: Partial unique index for idempotent recurring generation
-- (recurringTemplateId, departureAt) WHERE recurringTemplateId IS NOT NULL
-- SQL-only — Prisma DSL cannot express partial/WHERE-clause unique indices.
-- Ensures: one Trip per (template, departure slot) — prevents double-generation.
CREATE UNIQUE INDEX "Trip_recurringTemplateId_departureAt_uniq"
  ON "Trip"("recurringTemplateId", "departureAt")
  WHERE "recurringTemplateId" IS NOT NULL;

-- Block 7: Drop temporary DB-level default from @updatedAt (Prisma manages it in the client)
ALTER TABLE "Trip" ALTER COLUMN "updatedAt" DROP DEFAULT;
