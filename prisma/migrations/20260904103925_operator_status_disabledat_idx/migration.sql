-- DropIndex
DROP INDEX "Operator_status_idx";

-- CreateIndex
CREATE INDEX "Operator_status_disabledAt_idx" ON "Operator"("status", "disabledAt");
