-- Issue 045: Operator approval state machine.
-- `status` is the canonical approval state. `disabledAt` is kept (back-compat)
-- and synced to status by the transition service.

-- 1. Enum
CREATE TYPE "OperatorStatus" AS ENUM ('PENDING_REVIEW','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED');

-- 2. Columns (status NOT NULL with default so existing rows get a value)
ALTER TABLE "Operator" ADD COLUMN "status" "OperatorStatus" NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE "Operator" ADD COLUMN "rejectionReason" TEXT;

-- 3. Backfill existing operators: disabled → SUSPENDED, else APPROVED.
--    Pre-gate operators were already live, so they must remain searchable (APPROVED)
--    unless they were disabled, in which case SUSPENDED is the canonical equivalent.
UPDATE "Operator"
SET "status" = CASE
  WHEN "disabledAt" IS NOT NULL THEN 'SUSPENDED'::"OperatorStatus"
  ELSE 'APPROVED'::"OperatorStatus"
END;

-- 4. Index for status-filtered queries (search gate, admin review queue)
CREATE INDEX "Operator_status_idx" ON "Operator"("status");
