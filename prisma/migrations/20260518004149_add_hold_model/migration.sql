-- CreateEnum
CREATE TYPE "HoldStatus" AS ENUM ('active', 'converted', 'expired', 'cancelled_trip');

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "blockedSeats" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Hold" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "ticketCount" INTEGER NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "HoldStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hold_tripId_status_expiresAt_idx" ON "Hold"("tripId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "Hold_expiresAt_idx" ON "Hold"("expiresAt");

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
