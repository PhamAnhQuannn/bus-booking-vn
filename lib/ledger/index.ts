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

// Issue 067: per-operator fee override — inserts a NEW effective-dated FeeConfig
// row (never edits in place), closes the prior open override, writes an audit row.
export {
  setOperatorFeeOverride,
  FeeOverrideError,
  MAX_FEE_OVERRIDE_PPM,
  type SetOperatorFeeOverrideInput,
  type SetOperatorFeeOverrideResult,
} from './setOperatorFeeOverride';

// Issue 068: global platform-fee default — inserts a NEW effective-dated FeeConfig
// row with operatorId=null (never edits in place), closes the prior open global row,
// writes an audit row. Global-scope sibling of setOperatorFeeOverride (067).
export {
  setGlobalFee,
  GlobalFeeError,
  MAX_GLOBAL_FEE_PPM,
  type SetGlobalFeeInput,
  type SetGlobalFeeResult,
} from './setGlobalFee';

// Issue 068: manual operator-balance adjustment — a single signed `adjustment`
// ledger entry with a unique sourceEventId per action, reason required + audited.
export {
  addManualAdjustment,
  ManualAdjustmentError,
  type AddManualAdjustmentInput,
  type AddManualAdjustmentResult,
} from './addManualAdjustment';

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

// Issue 053: on-demand operator withdrawal — creates a (requested) non-trip-scoped
// Payout + sweep-aligned payout_debit; FOR-UPDATE-serialised, replay-idempotent.
export {
  requestWithdrawal,
  type RequestWithdrawalInput,
  type RequestWithdrawalResult,
} from './withdrawal';

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
