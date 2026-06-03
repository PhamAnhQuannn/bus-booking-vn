-- Issue 076: self-serve operator registration application reference.
-- Human-friendly unique reference (e.g. OP-2026-AB12CD) shown on the
-- confirmation page + pending email. Nullable: admin-CLI-provisioned operators
-- (Issue 020) have no application and leave this null.
ALTER TABLE "Operator" ADD COLUMN "applicationRef" TEXT;

-- @unique in the Prisma DSL → declare the matching unique index here so
-- schema.prisma and the DB stay in parity (Issue 007 rule).
CREATE UNIQUE INDEX "Operator_applicationRef_key" ON "Operator"("applicationRef");
