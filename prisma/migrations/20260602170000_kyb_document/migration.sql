-- Issue 077: operator KYB document submission.
-- One row per uploaded evidence doc. `storageKey` points at the StoredObject key
-- in the storage layer (lib/storage) — the DB stores the KEY, never the bytes.
-- FK operatorId → Operator(id) ON DELETE RESTRICT (KYB evidence outlives a delete
-- attempt; an operator with submitted docs cannot be hard-deleted out from under
-- the audit trail).
CREATE TABLE "KybDocument" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KybDocument_pkey" PRIMARY KEY ("id")
);

-- @@index([operatorId]) in the Prisma DSL → declare the matching index here so
-- schema.prisma and the DB stay in parity (Issue 007 rule).
CREATE INDEX "KybDocument_operatorId_idx" ON "KybDocument"("operatorId");

ALTER TABLE "KybDocument" ADD CONSTRAINT "KybDocument_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
