-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('awaiting_payment', 'pending_cash_payment', 'paid_operator_notified', 'completed', 'cancelled', 'trip_cancelled', 'no_show', 'payment_failed_expired');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'momo', 'zalopay', 'card');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('sms');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- AlterTable
ALTER TABLE "Operator" ADD COLUMN     "notificationPhone" TEXT;

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "bookingRef" TEXT NOT NULL,
    "confirmationToken" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "holdId" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerPhone" TEXT NOT NULL,
    "ticketCount" INTEGER NOT NULL,
    "totalVnd" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentExternalRef" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'awaiting_payment',
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "bookingId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'sms',
    "template" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "externalRef" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingRef_key" ON "Booking"("bookingRef");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_confirmationToken_key" ON "Booking"("confirmationToken");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_holdId_key" ON "Booking"("holdId");

-- CreateIndex
CREATE INDEX "Booking_tripId_status_idx" ON "Booking"("tripId", "status");

-- CreateIndex
CREATE INDEX "Booking_confirmationToken_idx" ON "Booking"("confirmationToken");

-- CreateIndex
CREATE INDEX "NotificationLog_bookingId_idx" ON "NotificationLog"("bookingId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "Hold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
