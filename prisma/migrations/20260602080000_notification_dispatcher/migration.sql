-- Issue 058: notification dispatcher retry/backoff state + idempotency &
-- dispatch-claim indices on NotificationLog.
--
-- The 'email' NotificationChannel enum value was added in the prior migration
-- (20260602070000_notification_channel_email) and is committed before this runs.

-- 1. Retry/backoff columns.
ALTER TABLE "NotificationLog"
  ADD COLUMN "attemptCount"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lastError"     TEXT;

-- 2. Idempotency (SYS09): one row per (bookingId, template).
--    bookingId is nullable; Postgres treats NULLs as DISTINCT, so null-booking
--    rows (operator temp-password SMS, etc.) are NOT deduped — that is correct.
CREATE UNIQUE INDEX "NotificationLog_bookingId_template_key"
  ON "NotificationLog"("bookingId", "template");

-- 3. Dispatch-claim index for the cron's due-row scan.
CREATE INDEX "NotificationLog_status_nextAttemptAt_idx"
  ON "NotificationLog"("status", "nextAttemptAt");
