-- PDPL retention (W4): NotificationLog PII marker. NULL = recipient/payload/lastError
-- still present. The retention sweeper scrubs those PII fields past
-- NOTIFICATION_PII_RETENTION_DAYS and stamps this; the row is KEPT (delivery-audit
-- evidence). erase != delete (S04).
ALTER TABLE "NotificationLog" ADD COLUMN "redactedAt" TIMESTAMP(3);

-- Partial index backing the sweeper's daily claim (not-yet-redacted rows). Keeps the
-- claim off a full-table scan as NotificationLog grows. PARTIAL/WHERE => SQL-only.
CREATE INDEX "NotificationLog_unredacted_idx"
  ON "NotificationLog" ("createdAt")
  WHERE "redactedAt" IS NULL;
