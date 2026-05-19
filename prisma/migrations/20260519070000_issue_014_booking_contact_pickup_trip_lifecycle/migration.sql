-- Issue 014: Operator Booking Queue + Manifest
-- Adds: ContactStatus enum, 10 new columns on Booking/Trip/OperatorUser, 2 indices on Booking,
--        PickupPoint→Booking FK relation.

-- 1. ContactStatus enum
CREATE TYPE "ContactStatus" AS ENUM ('pending', 'reached', 'no_answer', 'callback');

-- 2. Booking: contactStatus (NOT NULL, default 'pending')
ALTER TABLE "Booking"
  ADD COLUMN "contactStatus" "ContactStatus" NOT NULL DEFAULT 'pending';

-- 3. Booking: pickupPointId (FK → PickupPoint, nullable, ON DELETE SET NULL)
ALTER TABLE "Booking"
  ADD COLUMN "pickupPointId" TEXT;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_pickupPointId_fkey"
  FOREIGN KEY ("pickupPointId") REFERENCES "PickupPoint"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Booking: pickupNote (nullable text)
ALTER TABLE "Booking"
  ADD COLUMN "pickupNote" TEXT;

-- 5. Booking: pickedUpAt (nullable timestamp)
ALTER TABLE "Booking"
  ADD COLUMN "pickedUpAt" TIMESTAMP(3);

-- 6. Booking: cashCollectedAt (nullable timestamp)
ALTER TABLE "Booking"
  ADD COLUMN "cashCollectedAt" TIMESTAMP(3);

-- 7. Booking: escalationNote (nullable text)
ALTER TABLE "Booking"
  ADD COLUMN "escalationNote" TEXT;

-- 8. Booking: escalatedAt (nullable timestamp)
ALTER TABLE "Booking"
  ADD COLUMN "escalatedAt" TIMESTAMP(3);

-- 9. Trip: departedAt (nullable timestamp)
ALTER TABLE "Trip"
  ADD COLUMN "departedAt" TIMESTAMP(3);

-- 10. Trip: completedAt (nullable timestamp)
ALTER TABLE "Trip"
  ADD COLUMN "completedAt" TIMESTAMP(3);

-- 11. OperatorUser: lastBookingsViewedAt (nullable timestamp)
ALTER TABLE "OperatorUser"
  ADD COLUMN "lastBookingsViewedAt" TIMESTAMP(3);

-- 12. Indices on Booking
CREATE INDEX "Booking_tripId_contactStatus_idx" ON "Booking"("tripId", "contactStatus");
CREATE INDEX "Booking_tripId_pickedUpAt_idx" ON "Booking"("tripId", "pickedUpAt");
