-- AlterTable
ALTER TABLE "PaymentEvent" ADD COLUMN     "unmatchedReason" TEXT;

-- CreateIndex
CREATE INDEX "NotificationLog_status_attemptCount_idx" ON "NotificationLog"("status", "attemptCount");
