-- #841 (PDPL 91/2025): demonstrable consent evidence for the public charter form.
-- Nullable: rows created before this migration carry no consent record.
ALTER TABLE "CharterRequest" ADD COLUMN "consentVersion" TEXT,
ADD COLUMN "consentedAt" TIMESTAMP(3);
