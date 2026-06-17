-- Decree 117/2025: Tax withholding schema for platform tax obligations.
-- company operators self-file; individual_household operators get 4.5% withheld.

-- Step 1: TaxClassification enum
CREATE TYPE "TaxClassification" AS ENUM ('company', 'individual_household');

-- Step 2: Operator.taxClassification (defaults to company — existing operators exempt)
ALTER TABLE "Operator" ADD COLUMN "taxClassification" "TaxClassification" NOT NULL DEFAULT 'company';

-- Step 3: Payout tax columns (all default 0 — retroactively correct for pre-tax payouts)
ALTER TABLE "Payout" ADD COLUMN "taxVat" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payout" ADD COLUMN "taxPit" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payout" ADD COLUMN "taxTotal" INTEGER NOT NULL DEFAULT 0;
