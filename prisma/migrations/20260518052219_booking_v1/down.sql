-- Manual rollback for booking_v1 migration.
-- Prisma does not generate down migrations — apply this with psql if revert needed in prod.
--   psql $DATABASE_URL -f prisma/migrations/20260518052219_booking_v1/down.sql
-- Reverse-order to satisfy FK + enum dependencies.

DROP TABLE IF EXISTS "NotificationLog";
DROP TABLE IF EXISTS "Booking";
ALTER TABLE "Operator" DROP COLUMN IF EXISTS "notificationPhone";
DROP TYPE IF EXISTS "NotificationChannel";
DROP TYPE IF EXISTS "NotificationStatus";
DROP TYPE IF EXISTS "PaymentMethod";
DROP TYPE IF EXISTS "BookingStatus";
