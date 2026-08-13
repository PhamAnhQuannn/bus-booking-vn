-- CreateTable
CREATE TABLE "RefundObligation" (
    "id" TEXT NOT NULL,
    "bookingId" UUID NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerTxnId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundObligation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefundObligation_idempotencyKey_key" ON "RefundObligation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RefundObligation_status_nextAttemptAt_idx" ON "RefundObligation"("status", "nextAttemptAt");
