-- PDPL retention (W6): CharterRequest contact-PII marker. NULL = contactName/Phone/
-- Email/notes still present. The retention sweeper scrubs those on TERMINAL leads past
-- CHARTER_CONTACT_RETENTION_DAYS and stamps this; ref/status/assignee/destinations are
-- KEPT (operator-lead audit trail). erase != delete (S04).
ALTER TABLE "CharterRequest" ADD COLUMN "contactScrubbedAt" TIMESTAMP(3);

-- Index backing the sweeper's terminal-lead scrub claim (status + updatedAt). Prisma
-- DSL-expressible => also declared as @@index([status, updatedAt]).
CREATE INDEX "CharterRequest_status_updatedAt_idx" ON "CharterRequest"("status", "updatedAt");
