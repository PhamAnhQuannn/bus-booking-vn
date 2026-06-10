-- Issue 109: Pickup Points v2 schema foundation.
-- Behavior-preserving: `point` is an in-place rename of `area`; new columns default inert.
-- The `custom` PickupKind value + the custom-requires-detail CHECK land in Issue 111 (coupled to
-- the 3-way handling). No `ADD VALUE` here, so this whole migration is txn-safe as one file.

-- PickupPlaceKind: station (Bến xe — terminal) vs pickup (Đón tận nơi — door-to-door).
CREATE TYPE "PickupPlaceKind" AS ENUM ('station', 'pickup');

ALTER TABLE "OperatorPickupArea" ADD COLUMN "kind" "PickupPlaceKind" NOT NULL DEFAULT 'pickup';
ALTER TABLE "TripPickupArea"     ADD COLUMN "kind" "PickupPlaceKind" NOT NULL DEFAULT 'pickup';
ALTER TABLE "TemplatePickupArea" ADD COLUMN "kind" "PickupPlaceKind" NOT NULL DEFAULT 'pickup';

-- PickupKind: rename area -> point in-place (atomic; existing rows auto-migrate, no data copy).
ALTER TYPE "PickupKind" RENAME VALUE 'area' TO 'point';

-- customPickupRequested: inert boolean flag (defaults false). Wired to the custom path in Issue 111.
ALTER TABLE "Booking" ADD COLUMN "customPickupRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Hold"    ADD COLUMN "customPickupRequested" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Booking_tripId_customPickupRequested_idx" ON "Booking" ("tripId", "customPickupRequested");
