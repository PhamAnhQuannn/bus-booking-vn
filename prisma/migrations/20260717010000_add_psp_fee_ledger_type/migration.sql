-- Issue 123: PSP fee (MDR) ledger entry type for VNPay cost tracking.
-- psp_fee is PLATFORM-FLOAT — excluded from operator balance (like refund_out),
-- so it never affects operator-owed money; it tracks the platform's VNPay cost.
ALTER TYPE "LedgerEntryType" ADD VALUE 'psp_fee';
