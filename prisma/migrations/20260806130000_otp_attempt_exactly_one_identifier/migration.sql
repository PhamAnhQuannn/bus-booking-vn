-- P23 (#445): OtpAttempt must carry EXACTLY ONE of phone / email.
--
-- Customer OTP moved to email-only (migration 20260703030000_otp_email_column); phone
-- is legacy for every current writer but the column stays for historical rows. No code
-- path should ever write both columns or neither — this CHECK makes that a DB error
-- (SQLSTATE 23514) instead of a silent, ambiguous row.
--
-- PRE-FLIGHT (run against the target DB before applying — see #445): there must be no
-- violating rows, or ADD CONSTRAINT fails:
--   SELECT count(*) FROM "OtpAttempt"
--   WHERE ("phone" IS NOT NULL AND "email" IS NOT NULL)
--      OR ("phone" IS NULL AND "email" IS NULL);
-- OTP rows are short-lived (5-min TTL) so the table is tiny and this is a fast lock.
-- If the table were large, use ADD CONSTRAINT ... NOT VALID followed by a separate
-- VALIDATE CONSTRAINT.
--
-- SQL-only by necessity: Prisma DSL cannot express a table CHECK, so it stays out of
-- schema.prisma (documented on the OtpAttempt.phone field) and Prisma ignores it when diffing.
ALTER TABLE "OtpAttempt"
  ADD CONSTRAINT "OtpAttempt_exactly_one_identifier"
  CHECK (("phone" IS NOT NULL) <> ("email" IS NOT NULL));

-- NOTE: the partial unique index "OtpAttempt_phone_active_key" (from 20260519003311_issue_007_auth)
-- is deliberately KEPT — customer phone-change OTP (lib/account/customerOtp.ts, P16) writes
-- OtpAttempt.phone and relies on it for the `ON CONFLICT (phone) WHERE consumed = false` supersede.
