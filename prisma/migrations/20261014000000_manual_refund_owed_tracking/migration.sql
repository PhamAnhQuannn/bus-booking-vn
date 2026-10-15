-- #833: track manual refunds still owed to the customer. RefundObligation.status gains the
-- value 'manual_pending' (status is TEXT, no enum change); these columns record the admin's
-- "transferred" confirmation. Nullable, no backfill.
ALTER TABLE "RefundObligation" ADD COLUMN "manualPaidAt" TIMESTAMP(3),
ADD COLUMN "manualBankRef" TEXT;

-- #851: resolved state for UNFULFILLED (late / duplicate / underpaid) linked PaymentEvents,
-- so the admin tile counts unresolved ones only. Nullable, no backfill.
ALTER TABLE "PaymentEvent" ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "resolvedBankRef" TEXT;
