-- Remove the entire predefined pickup-area system.
-- Simplify PickupKind to station + custom (remove point).
-- Drop tables: RoutePickupArea, TripPickupArea, TemplatePickupArea, OperatorPickupArea.
-- Drop columns: Hold.pickupAreaId, Hold.pickupAreaLabel, Booking.pickupAreaId, Booking.pickupAreaLabel.
-- Drop enum: PickupPlaceKind.

-- Step 1a: For point rows that have BOTH pickupAreaLabel AND pickupDetail,
-- concatenate so neither is lost when the label column is dropped.
UPDATE "Hold"
SET "pickupDetail" = "pickupAreaLabel" || ' - ' || "pickupDetail"
WHERE "pickupKind" = 'point'::"PickupKind"
  AND "pickupDetail" IS NOT NULL
  AND "pickupAreaLabel" IS NOT NULL;

UPDATE "Booking"
SET "pickupDetail" = "pickupAreaLabel" || ' - ' || "pickupDetail"
WHERE "pickupKind" = 'point'::"PickupKind"
  AND "pickupDetail" IS NOT NULL
  AND "pickupAreaLabel" IS NOT NULL;

-- Step 1b: For point rows with only a label (no detail), copy label into detail.
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

-- Step 1c: Defensive fallback — point rows with neither label nor detail.
-- Satisfies CHECK constraint (pickupDetail >= 5 trimmed chars when customPickupRequested).
UPDATE "Hold"
SET "pickupDetail" = 'Diem don cu (chuyen doi)'
WHERE "pickupKind" = 'point'::"PickupKind"
  AND "pickupDetail" IS NULL;

UPDATE "Booking"
SET "pickupDetail" = 'Diem don cu (chuyen doi)'
WHERE "pickupKind" = 'point'::"PickupKind"
  AND "pickupDetail" IS NULL;

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
-- Must drop column defaults first — PG cannot auto-cast a DEFAULT typed as the old enum.
ALTER TABLE "Hold" ALTER COLUMN "pickupKind" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "pickupKind" DROP DEFAULT;
CREATE TYPE "PickupKind_new" AS ENUM ('station', 'custom');
ALTER TABLE "Hold" ALTER COLUMN "pickupKind" TYPE "PickupKind_new" USING "pickupKind"::text::"PickupKind_new";
ALTER TABLE "Booking" ALTER COLUMN "pickupKind" TYPE "PickupKind_new" USING "pickupKind"::text::"PickupKind_new";
DROP TYPE "PickupKind";
ALTER TYPE "PickupKind_new" RENAME TO "PickupKind";
-- Restore defaults with the new enum type.
ALTER TABLE "Hold" ALTER COLUMN "pickupKind" SET DEFAULT 'station'::"PickupKind";
ALTER TABLE "Booking" ALTER COLUMN "pickupKind" SET DEFAULT 'station'::"PickupKind";

-- Step 7: Drop PickupPlaceKind enum (no longer referenced).
DROP TYPE IF EXISTS "PickupPlaceKind";
