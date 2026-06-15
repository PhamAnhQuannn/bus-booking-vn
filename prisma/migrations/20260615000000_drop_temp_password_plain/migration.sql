-- AUTH-01: Drop plaintext temporary password column (security hardening).
-- Passwords are hashed in passwordHash; this column stored the plaintext
-- for display in the admin UI. The admin UI now shows "sent via SMS" instead.
ALTER TABLE "OperatorUser" DROP COLUMN IF EXISTS "tempPasswordPlain";
