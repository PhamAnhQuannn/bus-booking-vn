-- Issue 014 iter-2 QA fix: add scheduledFor column to NotificationLog (Finding 4)
-- Allows S19 cron to query WHERE template='payout_scheduled' AND scheduledFor <= NOW()

-- 1. Add nullable scheduledFor column
ALTER TABLE "NotificationLog"
  ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- 2. Index supporting S19 cron scan
CREATE INDEX "NotificationLog_template_scheduledFor_idx"
  ON "NotificationLog"("template", "scheduledFor");
