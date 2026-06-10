-- Issue 111: enforce that a custom pickup request carries a usable free-text detail.
-- customPickupRequested is true ⇔ pickupKind='custom'; in that case pickupDetail
-- must be a non-blank string of at least 5 trimmed characters. SQL-only — Prisma's
-- DSL cannot model a CHECK constraint, so these are documented via /// comments in
-- schema.prisma on Booking + Hold but never appear in the model diff.
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_custom_requires_detail"
  CHECK (NOT "customPickupRequested" OR ("pickupDetail" IS NOT NULL AND length(btrim("pickupDetail")) >= 5));
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_custom_requires_detail"
  CHECK (NOT "customPickupRequested" OR ("pickupDetail" IS NOT NULL AND length(btrim("pickupDetail")) >= 5));
