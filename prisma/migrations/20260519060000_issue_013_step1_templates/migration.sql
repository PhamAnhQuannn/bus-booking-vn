-- Issue 013 Step 1: RecurringTripTemplate + RecurringGenerationLog tables
-- Executed inside a single implicit transaction by Prisma migration runner.

-- Block 1: Create RecurringTripTemplate table
CREATE TABLE "RecurringTripTemplate" (
  "id"                  TEXT NOT NULL,
  "operatorId"          TEXT NOT NULL,
  "routeId"             TEXT NOT NULL,
  "busId"               TEXT NOT NULL,
  -- price in VND cents
  "price"               INTEGER NOT NULL,
  -- HH:MM local time string (e.g. "08:00")
  "departureLocalTime"  TEXT NOT NULL,
  -- bitmask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64 (range 1-127)
  "daysOfMask"          INTEGER NOT NULL,
  "validFrom"           DATE NOT NULL,
  "validUntil"          DATE NOT NULL,
  "deactivatedAt"       TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecurringTripTemplate_pkey" PRIMARY KEY ("id")
);

-- FK: operatorId → Operator
ALTER TABLE "RecurringTripTemplate"
  ADD CONSTRAINT "RecurringTripTemplate_operatorId_fkey"
  FOREIGN KEY ("operatorId") REFERENCES "Operator"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK: routeId → Route
ALTER TABLE "RecurringTripTemplate"
  ADD CONSTRAINT "RecurringTripTemplate_routeId_fkey"
  FOREIGN KEY ("routeId") REFERENCES "Route"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK: busId → Bus
ALTER TABLE "RecurringTripTemplate"
  ADD CONSTRAINT "RecurringTripTemplate_busId_fkey"
  FOREIGN KEY ("busId") REFERENCES "Bus"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Non-partial indices (declared in schema.prisma @@index below too)
CREATE INDEX "RecurringTripTemplate_operatorId_idx" ON "RecurringTripTemplate"("operatorId");
CREATE INDEX "RecurringTripTemplate_routeId_idx" ON "RecurringTripTemplate"("routeId");
CREATE INDEX "RecurringTripTemplate_busId_idx" ON "RecurringTripTemplate"("busId");

-- Block 2: Create RecurringGenerationLog table
CREATE TABLE "RecurringGenerationLog" (
  "id"          TEXT NOT NULL,
  "templateId"  TEXT NOT NULL,
  "date"        DATE NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'generated',
  -- skip reason for idempotency / skip entries
  "skipReason"  TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecurringGenerationLog_pkey" PRIMARY KEY ("id")
);

-- FK: templateId → RecurringTripTemplate
ALTER TABLE "RecurringGenerationLog"
  ADD CONSTRAINT "RecurringGenerationLog_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "RecurringTripTemplate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Non-partial indices (declared in schema.prisma @@index)
CREATE INDEX "RecurringGenerationLog_templateId_idx" ON "RecurringGenerationLog"("templateId");
CREATE INDEX "RecurringGenerationLog_date_idx" ON "RecurringGenerationLog"("date");

-- Drop the temporary DB default for updatedAt (Prisma manages @updatedAt in the client)
ALTER TABLE "RecurringTripTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;
