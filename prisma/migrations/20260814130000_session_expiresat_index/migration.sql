-- #474: standalone expiresAt indexes for the operator/admin session pruning sweeper.
-- Both tables carry only their *UserId index, so an expiresAt-only predicate
-- (WHERE "expiresAt" < …) can't use them and would seq-scan as the tables grow.
-- IF NOT EXISTS keeps the migration idempotent if an index was created out-of-band.
CREATE INDEX IF NOT EXISTS "OperatorSession_expiresAt_idx" ON "OperatorSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
