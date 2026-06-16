-- AlterEnum - must be in own migration (not transactional in PostgreSQL)
ALTER TYPE "LedgerEntryType" ADD VALUE 'tax_withheld';
