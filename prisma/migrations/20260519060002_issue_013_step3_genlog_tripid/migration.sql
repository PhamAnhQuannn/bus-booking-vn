-- Issue 013 Step 3: Add tripId column + FK to RecurringGenerationLog
-- The step1 migration omitted this column; migrations are immutable so we add it here.

ALTER TABLE "RecurringGenerationLog" ADD COLUMN "tripId" TEXT;
ALTER TABLE "RecurringGenerationLog"
  ADD CONSTRAINT "RecurringGenerationLog_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
