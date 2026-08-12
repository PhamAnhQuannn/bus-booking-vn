-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "boardingPoint" TEXT,
ADD COLUMN     "boardingTime" TEXT;

-- AlterTable
ALTER TABLE "Hold" ADD COLUMN     "boardingPoint" TEXT,
ADD COLUMN     "boardingTime" TEXT;
