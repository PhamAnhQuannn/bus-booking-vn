-- Revert financial FKs from SET NULL back to RESTRICT.
-- Migration 20260612063249 silently drifted these three constraints;
-- orphaned ledger/payout/fee rows violate the I7 causality invariant.

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_tripId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "FeeConfig" DROP CONSTRAINT "FeeConfig_operatorId_fkey";

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeConfig" ADD CONSTRAINT "FeeConfig_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
