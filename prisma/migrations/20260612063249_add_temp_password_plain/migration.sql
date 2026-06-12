-- DropForeignKey
ALTER TABLE "FeeConfig" DROP CONSTRAINT "FeeConfig_operatorId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_tripId_fkey";

-- AlterTable
ALTER TABLE "OperatorUser" ADD COLUMN     "tempPasswordPlain" TEXT;

-- AlterTable
ALTER TABLE "Place" ALTER COLUMN "aliases" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeConfig" ADD CONSTRAINT "FeeConfig_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
