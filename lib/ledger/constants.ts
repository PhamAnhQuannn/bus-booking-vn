/**
 * Ledger domain constants (Issue 050).
 *
 * MONEY-CRITICAL config. These are plain exported consts for this slice. A
 * DB-backed, effective-dated feature-flag store (à la FeeConfig, Issue 048) is
 * issue 060 — when it lands, `MIN_WITHDRAW_THRESHOLD_VND` becomes a read from
 * that store and this const becomes the bootstrap default. Until then a code
 * change + deploy is the way to adjust it (acceptable for a withdrawal floor).
 */

/**
 * Minimum operator `available` balance (in VND minor units — VND has no minor
 * unit, so this is plain VND) required before a withdrawal/payout request may be
 * initiated. Read by slice 053's withdrawal-request gate.
 *
 * Value: 100,000 VND (~4 USD). Rationale: keeps per-transfer bank fees and
 * reconciliation overhead proportionate to the disbursed amount, and matches
 * common VN PSP minimum-transfer floors. Configurable later via issue 060.
 */
export const MIN_WITHDRAW_THRESHOLD_VND = 100_000;

/**
 * Settlement delay before a completed trip's revenue moves from `pending` to
 * `available`: T+1 day (S15#5, ratified 2026-06-01). The 1-day buffer is the
 * dispute/chargeback window. Mirrors the same T+1 used at Payout-row creation
 * in lib/trips/completeTripCore.ts (ONE_DAY_MS there). The balance helper
 * expresses this as a SQL `interval '1 day'` (SETTLEMENT_DELAY_SQL_INTERVAL).
 *
 * Kept here as a documented single source so the balance bucket and the payout
 * scheduler stay in lockstep; if T+N changes, change it in both places (issue
 * 060 will unify both onto the FeeConfig-style store).
 */
export const SETTLEMENT_DELAY_DAYS = 1;

/** SQL interval literal for the T+1 settlement delay used in the balance bucket. */
export const SETTLEMENT_DELAY_SQL_INTERVAL = "1 day";

/**
 * VNPay MDR (Merchant Discount Rate) in parts-per-million, for the `psp_fee`
 * platform-float ledger entry written on a paid VNPay booking (Issue 123).
 * ppm encoding keeps the fee computation in the BigInt domain (see applyFeePpm).
 *
 * 11000 ppm = 1.1%. This is a PLACEHOLDER — VNPay's real per-transaction MDR
 * comes from the signed merchant contract (typically 0.5–2% by card type).
 *
 * TODO: replace with the real VNPay contract rate before go-live. A FeeConfig-
 * style effective-dated store (à la platform fee) is the eventual home; a const
 * is the bootstrap.
 */
export const VNPAY_MDR_PPM = 11000;
