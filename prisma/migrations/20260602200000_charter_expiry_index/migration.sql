-- Issue 086: predicate indices for the charter-expiry sweeper.
-- The sweeper claims stale rows with these exact predicates:
--   WHERE status='ASSIGNED_DIRECT' AND "acceptByAt" <= NOW()  (direct-assign timeout)
--   WHERE status='PUBLISHED'       AND "claimByAt"  <= NOW()  (public-pool expiry)
-- Both are non-partial composite indices, so per Issue 007 they are ALSO declared
-- as @@index in schema.prisma (DSL ↔ SQL parity).
CREATE INDEX "CharterRequest_status_acceptByAt_idx" ON "CharterRequest"("status", "acceptByAt");
CREATE INDEX "CharterRequest_status_claimByAt_idx" ON "CharterRequest"("status", "claimByAt");
