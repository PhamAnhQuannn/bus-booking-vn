-- Add email column to OtpAttempt for email-based OTP (customer auth switch from phone to email).
-- Make phone nullable (new email-based rows won't have a phone).
-- Keep existing phone-based partial unique index for backward compat (phone-change OTP).

ALTER TABLE "OtpAttempt" ALTER COLUMN "phone" DROP NOT NULL;

ALTER TABLE "OtpAttempt" ADD COLUMN "email" TEXT;

-- Partial unique index: at most one active (unconsumed) OTP per email address.
CREATE UNIQUE INDEX "OtpAttempt_email_active_key" ON "OtpAttempt"("email") WHERE consumed = false AND email IS NOT NULL;

-- Composite index for lookups by email + recency.
CREATE INDEX "OtpAttempt_email_createdAt_idx" ON "OtpAttempt"("email", "createdAt" DESC);
