-- Pickup points: add a named-stop identity to the operator pickup-area menu.
-- "name" is the stop name (required); "addressLine" is an optional street/landmark line.
-- Backfill existing rows' name from the ward label before enforcing NOT NULL.

ALTER TABLE "OperatorPickupArea" ADD COLUMN "name" TEXT;
ALTER TABLE "OperatorPickupArea" ADD COLUMN "addressLine" TEXT;

UPDATE "OperatorPickupArea" SET "name" = "label" WHERE "name" IS NULL;

ALTER TABLE "OperatorPickupArea" ALTER COLUMN "name" SET NOT NULL;
