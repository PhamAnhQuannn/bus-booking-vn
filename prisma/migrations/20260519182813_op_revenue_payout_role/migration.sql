-- Issue 016 — Operator Revenue CSV + T+3 Payout
-- Hand-written migration.
-- Note: ALTER TYPE ... ADD VALUE must run outside a transaction block in Postgres.
-- Prisma 7.8 generates this correctly as a standalone statement outside BEGIN/COMMIT.

-- Step 1: Add 'staff' to OperatorRole enum (must be outside transaction)
ALTER TYPE "OperatorRole" ADD VALUE 'staff';

-- Step 2: Create PayoutStatus enum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'processing', 'settled', 'failed');

-- Step 3: Create Payout table
CREATE TABLE "Payout" (
    "id"            TEXT NOT NULL,
    "tripId"        TEXT NOT NULL,
    "operatorId"    TEXT NOT NULL,
    "gross"         INTEGER NOT NULL,
    "platformFee"   INTEGER NOT NULL,
    "net"           INTEGER NOT NULL,
    "status"        "PayoutStatus" NOT NULL DEFAULT 'pending',
    "scheduledAt"   TIMESTAMP(3) NOT NULL,
    "settledAt"     TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Payout_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payout_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Step 4: Create indices matching @@index declarations in schema.prisma
CREATE INDEX "Payout_tripId_idx" ON "Payout"("tripId");
CREATE INDEX "Payout_status_scheduledAt_idx" ON "Payout"("status", "scheduledAt");
CREATE INDEX "Payout_operatorId_status_idx" ON "Payout"("operatorId", "status");
