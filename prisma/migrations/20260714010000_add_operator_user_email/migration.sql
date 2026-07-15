-- Add optional email column to OperatorUser for login 2FA (email OTP).
-- Nullable: operators without email continue to use password-only login.
ALTER TABLE "OperatorUser" ADD COLUMN "email" TEXT;
