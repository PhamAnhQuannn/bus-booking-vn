-- Issue 010: partial unique index + CHECK constraint not expressible in Prisma DSL

-- OperatorOtpAttempt: partial unique enforces single active (unconsumed) OTP per operator phone
CREATE UNIQUE INDEX "OperatorOtpAttempt_phone_active_key"
  ON "OperatorOtpAttempt"("phone") WHERE consumed = false;

-- OperatorUser: contactPhone and notificationPhone must differ
ALTER TABLE "OperatorUser" ADD CONSTRAINT "OperatorUser_phones_differ"
  CHECK ("contactPhone" <> "notificationPhone");