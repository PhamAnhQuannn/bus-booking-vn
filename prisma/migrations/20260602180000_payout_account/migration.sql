-- Issue 078: operator payout-account ownership verification.
-- One payout destination bank account per operator (operatorId UNIQUE). The
-- platform SENDS money TO accountNumber; it never reads the operator's bank.
-- accountNumber is sensitive PII (masked to last-4 on display, redacted in logs).
--
-- verifiedAt/verifyMethod are set by the verify flow (name-match / micro-deposit)
-- and RESET to NULL whenever the account is edited (re-verify required after any
-- change — see lib/onboarding/payoutAccount.ts). The payout rail (withdrawal +
-- sweep) only sends to a row with verifiedAt IS NOT NULL.
--
-- FK operatorId → Operator(id) ON DELETE RESTRICT: a payout destination must not
-- be silently orphaned by an operator delete attempt (money-adjacent audit trail).
CREATE TABLE "PayoutAccount" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verifyMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);

-- operatorId @unique in the Prisma DSL → matching unique index here (Issue 007 parity).
CREATE UNIQUE INDEX "PayoutAccount_operatorId_key" ON "PayoutAccount"("operatorId");

ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
