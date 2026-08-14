-- #475: standalone createdAt index for the OtpAttempt retention sweeper.
-- The existing composite indexes lead with phone/email, so a createdAt-only
-- predicate (WHERE "createdAt" < …) can't use them. IF NOT EXISTS keeps the
-- migration idempotent if the index was created out-of-band.
CREATE INDEX IF NOT EXISTS "OtpAttempt_createdAt_idx" ON "OtpAttempt"("createdAt");
