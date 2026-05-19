-- Reverse the issue_007_auth migration

-- 1. Drop Booking.customerId FK and column
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_customerId_fkey";
DROP INDEX IF EXISTS "Booking_customerId_idx";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "customerId";

-- 2. Drop Session table (cascade drops FK to Customer)
DROP INDEX IF EXISTS "Session_customerId_idx";
DROP TABLE IF EXISTS "Session" CASCADE;

-- 3. Drop OtpAttempt table + its partial indices
DROP INDEX IF EXISTS "OtpAttempt_phone_active_key";
DROP INDEX IF EXISTS "OtpAttempt_phone_createdAt_idx";
DROP TABLE IF EXISTS "OtpAttempt" CASCADE;

-- 4. Drop Customer table + its partial unique index
DROP INDEX IF EXISTS "Customer_email_key";
DROP TABLE IF EXISTS "Customer" CASCADE;
