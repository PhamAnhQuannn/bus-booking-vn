-- Remove the entire predefined pickup-area system.
-- Simplify PickupKind to station + custom (remove point).
-- Drop tables: RoutePickupArea, TripPickupArea, TemplatePickupArea, OperatorPickupArea.
-- Drop columns: Hold.pickupAreaId, Hold.pickupAreaLabel, Booking.pickupAreaId, Booking.pickupAreaLabel.
-- Drop enum: PickupPlaceKind.

-- Step 1: Rescue data — copy pickupAreaLabel into pickupDetail for point rows
-- that have no detail yet, so location info survives the column drop.
UPDATE "Hold"
SET "pickupDetail" = "pickupAreaLabel"
WHERE "pickupKind" = 'point'::"PickupKind"
  AND "pickupDetail" IS NULL
  AND "pickupAreaLabel" IS NOT NULL;

UPDATE "Booking"
SET "pickupDetail" = "pickupAreaLabel"
WHERE "pickupKind" = 'point'::"PickupKind"
  AND "pickupDetail" IS NULL
  AND "pickupAreaLabel" IS NOT NULL;

-- Pad short labels to satisfy CHECK (pickupDetail >= 5 trimmed chars when custom).
UPDATE "Hold"
SET "pickupDetail" = "pickupDetail" || ' (cũ)'
WHERE "pickupKind" = 'point'::"PickupKind"
  AND "pickupDetail" IS NOT NULL
  AND length(btrim("pickupDetail")) < 5;

UPDATE "Booking"
SET "pickupDetail" = "pickupDetail" || ' (cũ)'
WHERE "pickupKind" = 'point'::"PickupKind"
  AND "pickupDetail" IS NOT NULL
  AND length(btrim("pickupDetail")) < 5;

-- Flip customPickupRequested for point rows being migrated to custom.
UPDATE "Hold"
SET "customPickupRequested" = true
WHERE "pickupKind" = 'point'::"PickupKind";

UPDATE "Booking"
SET "customPickupRequested" = true
WHERE "pickupKind" = 'point'::"PickupKind";

-- Step 2: Backfill point → custom.
UPDATE "Hold"
SET "pickupKind" = 'custom'::"PickupKind"
WHERE "pickupKind" = 'point'::"PickupKind";

UPDATE "Booking"
SET "pickupKind" = 'custom'::"PickupKind"
WHERE "pickupKind" = 'point'::"PickupKind";

-- Step 3: Drop FK constraints on Hold and Booking pointing to OperatorPickupArea.
ALTER TABLE "Hold" DROP CONSTRAINT IF EXISTS "Hold_pickupAreaId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_pickupAreaId_fkey";

-- Step 4: Drop columns from Hold and Booking.
ALTER TABLE "Hold" DROP COLUMN IF EXISTS "pickupAreaId";
ALTER TABLE "Hold" DROP COLUMN IF EXISTS "pickupAreaLabel";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "pickupAreaId";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "pickupAreaLabel";

-- Step 5: Drop the 4 area tables (FK dependency order).
DROP TABLE IF EXISTS "RoutePickupArea";
DROP TABLE IF EXISTS "TripPickupArea";
DROP TABLE IF EXISTS "TemplatePickupArea";
DROP TABLE IF EXISTS "OperatorPickupArea";

-- Step 6: Recreate PickupKind enum without 'point'.
CREATE TYPE "PickupKind_new" AS ENUM ('station', 'custom');
ALTER TABLE "Hold" ALTER COLUMN "pickupKind" TYPE "PickupKind_new" USING "pickupKind"::text::"PickupKind_new";
ALTER TABLE "Booking" ALTER COLUMN "pickupKind" TYPE "PickupKind_new" USING "pickupKind"::text::"PickupKind_new";
DROP TYPE "PickupKind";
ALTER TYPE "PickupKind_new" RENAME TO "PickupKind";

-- Step 7: Drop PickupPlaceKind enum (no longer referenced).
DROP TYPE IF EXISTS "PickupPlaceKind";
