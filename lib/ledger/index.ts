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
// Issue 051: OPERATOR_BALANCE_TYPES — explicit balance-inclusion set (excludes refund_out).
export {
  getOperatorBalance,
  OPERATOR_BALANCE_TYPES,
  type OperatorBalance,
} from './balance';

// Issue 051: refund-out rail — refundOut writes refund_debit + refund_out (idempotent).
export {
  refundOut,
  RefundOutError,
  type RefundOutInput,
  type RefundOutResult,
  type RefundReason,
} from './refund';

// Issue 050: ledger-domain constants (withdrawal floor, settlement delay).
export {
  MIN_WITHDRAW_THRESHOLD_VND,
  SETTLEMENT_DELAY_DAYS,
  SETTLEMENT_DELAY_SQL_INTERVAL,
} from './constants';

// Issue 052: chargeback + payout_reversal — bank-dispute reversal (post-payout
// capable), operator liability + platform bad-debt backstop (S15#7). Idempotent.
export {
  recordChargeback,
  listChargebacks,
  ChargebackError,
  type RecordChargebackInput,
  type RecordChargebackResult,
  type DisputeEntry,
} from './chargeback';
