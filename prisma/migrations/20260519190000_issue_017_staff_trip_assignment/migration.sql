-- Issue 017 — Operator Staff Management: staff→trip assignment
-- Hand-written migration. Nullable FK, so no backfill required.

-- Step 1: Add nullable assignedTripId column to OperatorUser
ALTER TABLE "OperatorUser" ADD COLUMN "assignedTripId" TEXT;

-- Step 2: FK to Trip (nullable; SET NULL on trip delete so staff rows survive)
ALTER TABLE "OperatorUser"
    ADD CONSTRAINT "OperatorUser_assignedTripId_fkey"
    FOREIGN KEY ("assignedTripId") REFERENCES "Trip"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 3: Index matching @@index([assignedTripId]) in schema.prisma
CREATE INDEX "OperatorUser_assignedTripId_idx" ON "OperatorUser"("assignedTripId");

-- Step 4: Widen NotificationLog.bookingId to nullable so non-booking
--         notifications (staff temp password) can be logged. Backward-compatible:
--         existing rows + FK (onDelete Cascade) unaffected.
ALTER TABLE "NotificationLog" ALTER COLUMN "bookingId" DROP NOT NULL;
