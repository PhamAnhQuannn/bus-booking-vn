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
// Issue 049: calcPlatformFeeMinor — half-even fee for the ledger write.
export { getEffectiveFeeRate, applyFeePpm, calcPlatformFeeMinor } from './feeConfig';

// Issue 050: operator balance derived from SUM(LedgerEntry) — pending/available/paidOut.
export { getOperatorBalance, type OperatorBalance } from './balance';

// Issue 050: ledger-domain constants (withdrawal floor, settlement delay).
export {
  MIN_WITHDRAW_THRESHOLD_VND,
  SETTLEMENT_DELAY_DAYS,
  SETTLEMENT_DELAY_SQL_INTERVAL,
} from './constants';
