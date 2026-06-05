-- Issue 058: add 'email' to the NotificationChannel enum.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block on PostgreSQL
-- < 12, and even on >= 12 it must be COMMITTED before the new value can be used
-- by a later statement in the SAME transaction. Prisma runs each migration
-- directory's statements in their own transaction, so this ADD VALUE is ISOLATED
-- in its own migration directory (no other statements here) — the next migration
-- (20260602080000_notification_dispatcher) that may reference 'email' runs in a
-- separate, later transaction once this one has committed.
ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'email';
