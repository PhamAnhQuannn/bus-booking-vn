-- STEP 8 (auth-audit): Account — customer↔OAuth-provider link (DS-033 §2.1 / §5, #427).
--
-- One row per (provider, external account). Stores ONLY the provider subject id
-- (Google OIDC `sub`) + an audit-only email snapshot; NO Google access/refresh/id
-- tokens are persisted (identity is read once at callback and dropped, ADR-008).
--
-- FK ON DELETE CASCADE: a HARD delete of a Customer purges its Account rows. Soft
-- delete (deleteAccount) + the 730-day sweeper additionally deleteMany Account rows
-- explicitly, since a soft delete does not remove the Customer row.
--
-- Additive only: no new NOT NULL column on an existing table, no backfill. The
-- `Customer.emailVerifiedAt` column referenced by DS-033 §5 already exists (migration
-- 20260806120000) and is intentionally NOT re-added here.

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "Account_customerId_idx" ON "Account"("customerId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
