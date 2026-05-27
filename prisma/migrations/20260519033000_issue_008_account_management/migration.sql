-- Issue 008: Customer account management schema changes
-- 1. Make phone nullable (soft-delete anonymization: NULL freed phone allows re-registration)
-- 2. Add deletedAt and anonymizedAt timestamps

ALTER TABLE "Customer" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "Customer" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN "anonymizedAt" TIMESTAMP(3);
