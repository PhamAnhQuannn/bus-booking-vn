-- Circular 78/2021: E-invoice (hóa đơn điện tử) schema for GDT compliance.

-- Step 1: EInvoiceStatus enum
CREATE TYPE "EInvoiceStatus" AS ENUM ('pending', 'issued', 'sent', 'failed', 'cancelled');

-- Step 2: Booking e-invoice reference columns (nullable — set when invoice issued)
ALTER TABLE "Booking" ADD COLUMN "einvoiceRef" TEXT;
ALTER TABLE "Booking" ADD COLUMN "einvoiceIssuedAt" TIMESTAMPTZ;

-- Step 3: EInvoice table
CREATE TABLE "EInvoice" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "status" "EInvoiceStatus" NOT NULL DEFAULT 'pending',
    "vendorRef" TEXT,
    "rawResponse" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EInvoice_pkey" PRIMARY KEY ("id")
);

-- Step 4: Foreign keys
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: Indices
CREATE INDEX "EInvoice_bookingId_idx" ON "EInvoice"("bookingId");
CREATE INDEX "EInvoice_operatorId_createdAt_idx" ON "EInvoice"("operatorId", "createdAt");
CREATE INDEX "EInvoice_status_idx" ON "EInvoice"("status");

-- Partial unique: GDT compliance -- no duplicate invoice numbers (Circular 78/2021)
CREATE UNIQUE INDEX "EInvoice_invoiceNumber_key" ON "EInvoice"("invoiceNumber") WHERE "invoiceNumber" IS NOT NULL;

-- Index for invoice ref lookups
CREATE INDEX "Booking_einvoiceRef_idx" ON "Booking"("einvoiceRef") WHERE "einvoiceRef" IS NOT NULL;

-- Ensure einvoiceRef and einvoiceIssuedAt are set/unset together
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_einvoice_consistency" CHECK (("einvoiceRef" IS NULL) = ("einvoiceIssuedAt" IS NULL));
