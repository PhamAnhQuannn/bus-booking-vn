-- WT-13: Add cash and bank_transfer to PaymentMethod enum.
-- cash = station-collected (operator confirms on console, no PSP webhook).
-- bank_transfer = VietQR + SePay webhook confirmation (Phase 1 primary online PSP).
-- Per DS-001 §2.6 line 852.

ALTER TYPE "PaymentMethod" ADD VALUE 'cash';
ALTER TYPE "PaymentMethod" ADD VALUE 'bank_transfer';
