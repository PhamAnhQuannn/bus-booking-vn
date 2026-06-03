-- Issue 066: admin suspension for customers. Non-null = suspended.
ALTER TABLE "Customer" ADD COLUMN "suspendedAt" TIMESTAMP(3);
