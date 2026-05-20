-- CreateTable
CREATE TABLE "JobRunLog" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "rowsAffected" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobRunLog_jobName_startedAt_idx" ON "JobRunLog"("jobName", "startedAt");

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Booking_status_reminderSentAt_idx" ON "Booking"("status", "reminderSentAt");
