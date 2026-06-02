/**
 * Ledger domain barrel (Issues 047, 048).
 */

export {
  appendLedgerEntry,
  deriveOperatorBalance,
  type AppendLedgerEntryInput,
  type AppendLedgerEntryResult,
  type LedgerEntryType,
} from './ledgerRepo';

// Issue 048: effective-dated platform-fee source (read helper + ppm math).
export { getEffectiveFeeRate, applyFeePpm } from './feeConfig';
