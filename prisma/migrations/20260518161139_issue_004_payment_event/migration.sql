-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bookingId" UUID NOT NULL,
    "adapter" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "rawBody" TEXT NOT NULL,
    "resultCode" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentEvent_bookingId_idx" ON "PaymentEvent"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_adapter_externalRef_key" ON "PaymentEvent"("adapter", "externalRef");

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
