-- Issue 104: personal pickup destinations — operator-defined areas + traveler self-select.
-- Adds OperatorPickupArea / TripPickupArea / TemplatePickupArea, the PickupKind enum,
-- Operator province + Hold/Booking pickup snapshot columns; removes the legacy
-- route-scoped PickupPoint and its Booking columns (greenfield: pre-launch, no prod data).
--
-- NOTE: `prisma migrate diff` also surfaced PRE-EXISTING drift unrelated to pickup
-- (Payout/LedgerEntry/FeeConfig FK onDelete=SetNull, Place.aliases default). Those are
-- deliberately NOT included here — silently changing delete behaviour on financial tables
-- inside a pickup migration is out of scope; reconcile that drift in its own migration.

-- CreateEnum
CREATE TYPE "PickupKind" AS ENUM ('station', 'area');

-- DropForeignKey (legacy PickupPoint removal)
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_pickupPointId_fkey";
ALTER TABLE "PickupPoint" DROP CONSTRAINT "PickupPoint_routeId_fkey";

-- AlterTable: Booking — drop legacy pickup columns, add new pickup snapshot
ALTER TABLE "Booking" DROP COLUMN "pickupNote",
DROP COLUMN "pickupPointId",
ADD COLUMN     "pickupAreaId" TEXT,
ADD COLUMN     "pickupAreaLabel" TEXT,
ADD COLUMN     "pickupDetail" TEXT,
ADD COLUMN     "pickupKind" "PickupKind" NOT NULL DEFAULT 'station';

-- AlterTable: Hold — pickup selection captured at hold time
ALTER TABLE "Hold" ADD COLUMN     "pickupAreaId" TEXT,
ADD COLUMN     "pickupAreaLabel" TEXT,
ADD COLUMN     "pickupDetail" TEXT,
ADD COLUMN     "pickupKind" "PickupKind" NOT NULL DEFAULT 'station';

-- AlterTable: Operator — base province from the application
ALTER TABLE "Operator" ADD COLUMN     "provinceCode" TEXT,
ADD COLUMN     "provinceName" TEXT;

-- DropTable: legacy route-scoped pickup points
DROP TABLE "PickupPoint";

-- CreateTable
CREATE TABLE "OperatorPickupArea" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "provinceCode" TEXT NOT NULL,
    "districtCode" TEXT NOT NULL,
    "districtName" TEXT NOT NULL,
    "wardCode" TEXT NOT NULL,
    "wardName" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorPickupArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripPickupArea" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "operatorPickupAreaId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "TripPickupArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplatePickupArea" (
    "id" TEXT NOT NULL,
    "recurringTemplateId" TEXT NOT NULL,
    "operatorPickupAreaId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "TemplatePickupArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperatorPickupArea_operatorId_isActive_idx" ON "OperatorPickupArea"("operatorId", "isActive");

-- CreateIndex
CREATE INDEX "TripPickupArea_tripId_displayOrder_idx" ON "TripPickupArea"("tripId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TripPickupArea_tripId_operatorPickupAreaId_key" ON "TripPickupArea"("tripId", "operatorPickupAreaId");

-- CreateIndex
CREATE INDEX "TemplatePickupArea_recurringTemplateId_displayOrder_idx" ON "TemplatePickupArea"("recurringTemplateId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TemplatePickupArea_recurringTemplateId_operatorPickupAreaId_key" ON "TemplatePickupArea"("recurringTemplateId", "operatorPickupAreaId");

-- AddForeignKey
ALTER TABLE "OperatorPickupArea" ADD CONSTRAINT "OperatorPickupArea_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPickupArea" ADD CONSTRAINT "TripPickupArea_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPickupArea" ADD CONSTRAINT "TripPickupArea_operatorPickupAreaId_fkey" FOREIGN KEY ("operatorPickupAreaId") REFERENCES "OperatorPickupArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplatePickupArea" ADD CONSTRAINT "TemplatePickupArea_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "RecurringTripTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplatePickupArea" ADD CONSTRAINT "TemplatePickupArea_operatorPickupAreaId_fkey" FOREIGN KEY ("operatorPickupAreaId") REFERENCES "OperatorPickupArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_pickupAreaId_fkey" FOREIGN KEY ("pickupAreaId") REFERENCES "OperatorPickupArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_pickupAreaId_fkey" FOREIGN KEY ("pickupAreaId") REFERENCES "OperatorPickupArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
