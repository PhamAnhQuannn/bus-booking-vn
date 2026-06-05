-- Issue 081: CharterRequest model + state machine.
-- Lead-gen only — NO charter payment rail (S15#9). The transition map lives in
-- lib/charter/charterStatus.ts (single source). `status` is the canonical state.

-- 1. Enum
CREATE TYPE "CharterStatus" AS ENUM (
  'SUBMITTED',
  'ADMIN_REVIEW',
  'ASSIGNED_DIRECT',
  'PUBLISHED',
  'ACCEPTED',
  'DECLINED',
  'REJECTED',
  'EXPIRED',
  'COMPLETED',
  'CANCELLED'
);

-- 2. Table
CREATE TABLE "CharterRequest" (
  "id" TEXT NOT NULL,
  "ref" TEXT NOT NULL,
  "customerId" TEXT,
  "contactName" TEXT NOT NULL,
  "contactPhone" TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "originPlaceId" TEXT,
  "destinations" JSONB NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "durationDays" INTEGER,
  "passengers" INTEGER NOT NULL,
  "vehicleType" TEXT NOT NULL,
  "budgetVnd" INTEGER,
  "notes" TEXT,
  "status" "CharterStatus" NOT NULL DEFAULT 'SUBMITTED',
  "assigneeOperatorId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "claimByAt" TIMESTAMP(3),
  "acceptByAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CharterRequest_pkey" PRIMARY KEY ("id")
);

-- 3. Unique ref + the two declared indices (Issue 007: non-partial indices are
--    declared in schema.prisma too, so DSL ↔ SQL stay in parity).
CREATE UNIQUE INDEX "CharterRequest_ref_key" ON "CharterRequest"("ref");
CREATE INDEX "CharterRequest_status_createdAt_idx" ON "CharterRequest"("status", "createdAt");
CREATE INDEX "CharterRequest_assigneeOperatorId_idx" ON "CharterRequest"("assigneeOperatorId");

-- 4. FKs — all three nullable, ON DELETE SET NULL (a deleted customer / place /
--    operator must NOT cascade-delete the lead record).
ALTER TABLE "CharterRequest" ADD CONSTRAINT "CharterRequest_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CharterRequest" ADD CONSTRAINT "CharterRequest_originPlaceId_fkey"
  FOREIGN KEY ("originPlaceId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CharterRequest" ADD CONSTRAINT "CharterRequest_assigneeOperatorId_fkey"
  FOREIGN KEY ("assigneeOperatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
