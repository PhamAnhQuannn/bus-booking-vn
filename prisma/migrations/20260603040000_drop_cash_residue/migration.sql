-- Issue 088 (cash-only descope): drop the dead cash rail residue.
-- Cash creation paths were removed in Issues 039/040; no live writer sets these
-- values. This forward migration drops:
--   * Booking.cashCollectedAt column
--   * PaymentMethod enum value 'cash'
--   * BookingStatus enum value 'pending_cash_payment'
--
-- Postgres cannot DROP a single enum value, so each enum is recreated (rename →
-- create-new → ALTER COLUMN ... USING → drop-old). Each enum is used by exactly
-- one column (Booking.paymentMethod / Booking.status).
--
-- LIVE-ROW PRE-CHECK: the USING casts below ERROR if any row still holds a doomed
-- value. Expected count is 0 (run before applying):
--   SELECT count(*) FROM "Booking" WHERE "paymentMethod" = 'cash'
--                                      OR "status" = 'pending_cash_payment';

-- 1. Drop the dead cash-collection column (no index / FK references it).
ALTER TABLE "Booking" DROP COLUMN "cashCollectedAt";

-- 2. PaymentMethod: drop 'cash' (column has no default).
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
CREATE TYPE "PaymentMethod" AS ENUM ('momo', 'zalopay', 'card');
ALTER TABLE "Booking"
  ALTER COLUMN "paymentMethod" TYPE "PaymentMethod"
  USING ("paymentMethod"::text::"PaymentMethod");
DROP TYPE "PaymentMethod_old";

-- 3. BookingStatus: drop 'pending_cash_payment' (column default = awaiting_payment;
--    drop then re-set the default around the type swap).
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
CREATE TYPE "BookingStatus" AS ENUM (
  'awaiting_payment',
  'paid',
  'completed',
  'cancelled',
  'trip_cancelled',
  'no_show',
  'payment_failed_expired',
  'refunded'
);
ALTER TABLE "Booking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Booking"
  ALTER COLUMN "status" TYPE "BookingStatus"
  USING ("status"::text::"BookingStatus");
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'awaiting_payment';
DROP TYPE "BookingStatus_old";
