-- #359 hold seat-squatting: bound seats per anonymous session.
--
-- Additive and nullable only. Existing rows keep NULL, which the cap treats as
-- "no session to attribute" — createHold skips the session check entirely for a
-- NULL sessionId rather than lumping every cookie-less caller into one bucket.
ALTER TABLE "Hold" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

-- Supports the per-session active-seat SUM taken under the session advisory lock.
-- Partial on status/expiry is not used here: the predicate is (sessionId, status,
-- expiresAt > now()) and NOW() is not immutable, so a plain composite is correct
-- and expressible in the Prisma DSL (kept in sync in schema.prisma per the
-- Issue-007 raw-SQL-index rule).
CREATE INDEX IF NOT EXISTS "Hold_sessionId_status_expiresAt_idx"
  ON "Hold" ("sessionId", "status", "expiresAt");
