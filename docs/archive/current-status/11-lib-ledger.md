# 11 -- lib/ledger/ (Append-Only Financial Ledger)

> **Domain**: Financial ledger, operator balance, payouts, refunds, chargebacks, fee configuration, revenue reporting.
> **Issues**: 047 (core ledger), 048 (fee config), 049 (fee math), 050 (balance buckets), 051 (refund-out rail), 052 (chargeback), 053 (withdrawal), 067 (operator fee override), 068 (global fee + manual adjustment).

---

## Foundational Rules

### Immutability

The `LedgerEntry` table is **INSERT-ONLY**. UPDATE and DELETE are blocked at the database by the `ledger_entry_immutable` trigger (migration `20260602020000_ledger_entry`). This trigger fires regardless of the connecting DB role. The Prisma DSL cannot model triggers, so this constraint is invisible to `prisma migrate diff`.

Corrections are made by appending new entries (e.g., `adjustment`, `payout_reversal`), never by editing existing rows.

### BigInt Arithmetic (Issue 016)

All currency math uses `BigInt` to avoid IEEE 754 float drift. The ES2017 target prohibits `1n`/`0n` literal syntax -- use `BigInt(1)`, `BigInt(0)` constructor calls everywhere.

Key patterns:
- Fee computation: `(amountMinor * BigInt(ratePpm)) / BigInt(1_000_000)` -- entirely integer arithmetic.
- Postgres `SUM(BIGINT)` returns `NUMERIC`; cast to `::text` and parse with `BigInt()` in JS to avoid `Number` round-trip.
- `number` inputs are coerced via `BigInt(Math.round(n))` as a defensive net.

### Sign Convention

`amount` is a **signed integer** in VND minor units (VND has no fractional unit, so minor = VND). Positive = credit TO operator balance; negative = debit FROM it.

### Idempotency

Every ledger write uses a unique `sourceEventId` (@@unique constraint). `appendLedgerEntry` catches Prisma `P2002` (unique violation) and re-reads the existing row, returning `{ created: false }`. Multi-leg operations derive DISTINCT sourceEventIds from a single caller key (e.g., `refund_debit:<key>`, `refund_out:<key>`).

---

## LedgerEntryType Enum

Defined in `prisma/schema.prisma` (line 984):

| Value | Sign | Counts in Operator Balance | Purpose |
|---|---|---|---|
| `booking_credit` | + | Yes | Operator earns the fare when a booking is paid |
| `platform_fee` | - | Yes | Platform's cut deducted at booking-paid time |
| `refund_debit` | - | Yes | Claws back operator's credit on a refund |
| `refund_out` | - | **No** (platform float) | Cash paid back to the customer; excluded from operator balance to prevent double-subtraction |
| `payout_debit` | - | Yes (bucketed as paidOut) | Drains operator balance when funds are disbursed |
| `payout_reversal` | + | Yes | Failed/clawed-back payout restored to balance |
| `chargeback` | - | Yes | Bank-initiated reversal of operator revenue |
| `adjustment` | +/- | Yes | Manual correction in either direction |
| `tax_withheld` | - | Yes (bucketed with paidOut) | Tax withheld on payouts |

---

## Operator Balance Model

The operator's balance is **never a stored mutable column**. It is always **derived** as a SUM over `LedgerEntry`, split into three buckets:

| Bucket | Definition |
|---|---|
| `pending` | Revenue earned but not yet settlement-eligible: linked trip not completed, or completed but T+1 settlement delay has not elapsed |
| `available` | Withdrawable now: settlement-eligible total minus everything already paid out (`settledEligible - paidOut`) |
| `paidOut` | Total already disbursed: magnitude of `payout_debit` entries (stored negative, reported as positive) |

The `OPERATOR_BALANCE_TYPES` array is the single source of truth for which entry types participate in the operator balance. `refund_out` is deliberately excluded.

---

## File Inventory

### Core Ledger

| File | Purpose |
|---|---|
| `ledgerRepo.ts` | Append-only ledger write + naive total balance derivation |
| `balance.ts` | Three-bucket operator balance (pending/available/paidOut) |
| `constants.ts` | Domain constants (withdrawal threshold, settlement delay) |
| `feeConfig.ts` | Effective-dated platform fee rate resolution + ppm math |
| `calcPayout.ts` | Platform fee computation with half-even (banker's) rounding |
| `index.ts` | Barrel re-exports for the domain |

### Money Operations

| File | Purpose |
|---|---|
| `withdrawal.ts` | On-demand operator withdrawal with FOR UPDATE concurrency |
| `settlePayout.ts` | Bank settlement dispatch stub (V1) |
| `retryPayout.ts` | Transition a failed Payout to processing for re-attempt |
| `refund.ts` | Refund-out rail: double-entry refund_debit + refund_out |
| `chargeback.ts` | Bank dispute reversal (pre- and post-payout) with backstop |
| `addManualAdjustment.ts` | Admin manual balance correction with audit trail |

### Fee Administration

| File | Purpose |
|---|---|
| `setOperatorFeeOverride.ts` | Per-operator fee override (new effective-dated FeeConfig row) |
| `setGlobalFee.ts` | Global platform fee default (new FeeConfig row, operatorId=null) |

### Reporting

| File | Purpose |
|---|---|
| `getRevenueReport.ts` | Per-trip aggregated revenue rows for an operator |
| `getBookingRevenueRows.ts` | Per-booking revenue rows for CSV export |
| `getPayoutReport.ts` | Payout history rows for an operator |
| `buildRevenueCsv.ts` | UTF-8 BOM CSV builder for per-trip revenue |
| `buildBookingRevenueCsv.ts` | UTF-8 BOM CSV builder for per-booking revenue |

---

## Detailed Export Reference

### `ledgerRepo.ts`

| Export | Kind | Description |
|---|---|---|
| `appendLedgerEntry(input, client?)` | async function | Inserts one immutable ledger entry. Idempotent on `sourceEventId` (P2002 catch). `client` defaults to global Prisma; accepts a `tx` handle for transactional use. |
| `deriveOperatorBalance(operatorId)` | async function | Naive SUM of all entries for an operator (BigInt). Superseded by `getOperatorBalance` for production use. |
| `AppendLedgerEntryInput` | interface | `{ operatorId, bookingId?, payoutId?, type, amountMinor: bigint\|number, currency?, sourceEventId }` |
| `AppendLedgerEntryResult` | interface | `{ id: string, created: boolean }` |
| `LedgerEntryType` | type (re-export) | Re-exported from `@prisma/client` |
| `LedgerEntryWriter` | interface | Minimal Prisma surface for DI (`ledgerEntry.create` + `ledgerEntry.findUnique`) |

### `balance.ts`

| Export | Kind | Description |
|---|---|---|
| `getOperatorBalance(operatorId)` | async function | Returns `{ pending, available, paidOut }` as `bigint` values. Single raw SQL query joining LedgerEntry -> Booking -> Trip. |
| `OperatorBalance` | interface | `{ pending: bigint, available: bigint, paidOut: bigint }` |
| `OPERATOR_BALANCE_TYPES` | const array | `['booking_credit', 'platform_fee', 'refund_debit', 'payout_debit', 'payout_reversal', 'chargeback', 'adjustment', 'tax_withheld']` -- explicit inclusion set; `refund_out` excluded |

### `calcPayout.ts`

| Export | Kind | Description |
|---|---|---|
| `calcPayout(input)` | function | Computes `{ gross, platformFee, net }` using BigInt multiplication with half-even rounding. Default fee 6%. Converts `platformFeePct` to `BigInt` ratio with 1e10 precision. |
| `halfEvenRound(x)` | function | Banker's rounding: exact 0.5 midpoints round to nearest even. Used for Number-domain rounding (legacy path). |
| `CalcPayoutInput` | interface | `{ grossPaidBookings: number, platformFeePct?: number }` |
| `CalcPayoutResult` | interface | `{ gross: number, platformFee: number, net: number }` |

### `feeConfig.ts`

| Export | Kind | Description |
|---|---|---|
| `getEffectiveFeeRate(operatorId, atTime, client?)` | async function | Resolves the fee rate (ppm integer) in force for an operator at a given time. Override-then-global resolution. Throws if no covering FeeConfig row exists. |
| `applyFeePpm(amountMinor, ratePpm)` | function | `(amountMinor * BigInt(ratePpm)) / BigInt(1_000_000)` -- floor/truncation rounding. Pure BigInt. |
| `calcPlatformFeeMinor(grossMinor, feePpm)` | function | Same as `applyFeePpm` but with **half-even** rounding (matches `calcPayout` output bit-for-bit). Used for ledger `platform_fee` entries. |

### `constants.ts`

| Export | Kind | Value | Description |
|---|---|---|---|
| `MIN_WITHDRAW_THRESHOLD_VND` | const | `100_000` | Minimum operator available balance for withdrawal (100,000 VND) |
| `SETTLEMENT_DELAY_DAYS` | const | `1` | T+1 settlement delay (dispute/chargeback window) |
| `SETTLEMENT_DELAY_SQL_INTERVAL` | const | `"1 day"` | SQL interval literal for the T+1 delay |

### `withdrawal.ts`

| Export | Kind | Description |
|---|---|---|
| `requestWithdrawal(input)` | async function | On-demand operator withdrawal. FOR UPDATE on Operator row serializes concurrent withdrawals. Two-layer idempotency: Layer 1 pre-tx probe of marker key, Layer 2 in-lock re-probe. Creates Payout (status=requested) + payout_debit + zero-amount marker. |
| `RequestWithdrawalInput` | interface | `{ operatorId, amountMinor: number, idempotencyKey }` |
| `RequestWithdrawalResult` | type | `{ ok: true, payoutId } \| { ok: false, reason: 'below_min' \| 'insufficient_available' \| 'invalid_amount' \| 'payout_account_unverified' }` |

### `settlePayout.ts`

| Export | Kind | Description |
|---|---|---|
| `settlePayout(input)` | async function | V1 stub: no real network I/O. Returns `{ ok: true }` by default; returns failure when `PAYOUT_SETTLEMENT_FORCE_FAIL` env is `"true"`. |
| `SettlePayoutInput` | interface | `{ payoutId, operatorId, net }` |
| `SettlePayoutResult` | type | `{ ok: true } \| { ok: false, reason: string }` |

### `retryPayout.ts`

| Export | Kind | Description |
|---|---|---|
| `retryPayout(input)` | async function | Transitions a `failed` Payout to `processing`. SELECT FOR UPDATE on Payout row. Discriminated result (not thrown sentinel). |
| `RetryPayoutResult` | type | `{ ok: true, payout } \| { ok: false, error: 'not_found' \| 'wrong_operator' \| 'not_failed' }` |

### `refund.ts`

| Export | Kind | Description |
|---|---|---|
| `refundOut(input)` | async function | Double-entry refund: writes `refund_debit` (counts in balance) + `refund_out` (platform float, excluded from balance) in one transaction. Calls PSP refund before ledger writes. Layer-1 idempotency on `refund_out:<key>`. |
| `RefundOutError` | class | Error with `code` property. Codes: `'invalid_amount'`, `'booking_not_found'`, `'not_refundable'` |
| `RefundOutInput` | interface | `{ bookingId, amountMinor, reason: RefundReason, idempotencyKey }` |
| `RefundOutResult` | interface | `{ refunded: boolean, alreadyDone: boolean }` |
| `RefundReason` | type | `'operator_cancel' \| 'overpay_difference' \| 'oversold_race'` |

### `chargeback.ts`

| Export | Kind | Description |
|---|---|---|
| `recordChargeback(input)` | async function | Bank dispute reversal. Pre-payout: single `chargeback` (-amount). Post-payout: `payout_reversal` (+amount) + `chargeback` (-2*amount), NET = -amount. Backstop adjustment for uncoverable shortfall (S15#7). All legs in one transaction. |
| `listChargebacks(operatorId?)` | async function | Returns dispute-related ledger entries (chargeback + payout_reversal + backstop adjustments). Newest first. |
| `ChargebackError` | class | Error with `code` property. Codes: `'invalid_amount'`, `'booking_not_found'` |
| `RecordChargebackInput` | interface | `{ bookingId, amountMinor, sourceEventId }` |
| `RecordChargebackResult` | interface | `{ recorded: boolean, alreadyDone: boolean, backstopped: number }` |
| `DisputeEntry` | interface | `{ id, operatorId, bookingId, type, amount: bigint, currency, sourceEventId, createdAt }` |

### `addManualAdjustment.ts`

| Export | Kind | Description |
|---|---|---|
| `addManualAdjustment(prisma?, input)` | async function | Appends a single `adjustment` entry with unique UUID-based sourceEventId. Writes audit log in same transaction. Reason required. |
| `ManualAdjustmentError` | class | Error with `code: 'invalid_amount' \| 'missing_reason'` |
| `AddManualAdjustmentInput` | interface | `{ operatorId, amountMinor: number (signed), reason, actor }` |
| `AddManualAdjustmentResult` | interface | `{ ledgerEntryId: string }` |

### `setGlobalFee.ts`

| Export | Kind | Description |
|---|---|---|
| `setGlobalFee(prisma?, input)` | async function | Inserts a new global FeeConfig row (operatorId=null). Closes prior open global row. Writes audit log. All in one transaction. Never edits in place. |
| `GlobalFeeError` | class | Error with `code: 'invalid_rate'` |
| `MAX_GLOBAL_FEE_PPM` | const | `200_000` (20%) |
| `SetGlobalFeeInput` | interface | `{ ratePpm, actor, effectiveFrom?: Date }` |
| `SetGlobalFeeResult` | interface | `{ feeConfigId: string }` |

### `setOperatorFeeOverride.ts`

| Export | Kind | Description |
|---|---|---|
| `setOperatorFeeOverride(prisma?, input)` | async function | Inserts a new per-operator FeeConfig row. Closes prior open override for that operator. Writes audit log. All in one transaction. Never edits in place. |
| `FeeOverrideError` | class | Error with `code: 'invalid_rate'` |
| `MAX_FEE_OVERRIDE_PPM` | const | `200_000` (20%) |
| `SetOperatorFeeOverrideInput` | interface | `{ operatorId, ratePpm, actor, effectiveFrom?: Date }` |
| `SetOperatorFeeOverrideResult` | interface | `{ feeConfigId: string }` |

### `getRevenueReport.ts`

| Export | Kind | Description |
|---|---|---|
| `getRevenueReport(input)` | async function | Queries paid bookings grouped by trip. Returns `RevenueRow[]` sorted by departureAt ascending. Date window interpreted as Asia/Ho_Chi_Minh (UTC+7). |
| `GetRevenueReportInput` | interface | `{ operatorId, dateFrom, dateTo, routeId? }` |
| `RevenueRow` | type (re-export) | Re-exported from `buildRevenueCsv.ts` |

### `getBookingRevenueRows.ts`

| Export | Kind | Description |
|---|---|---|
| `getBookingRevenueRows(input)` | async function | Queries paid bookings returning per-booking rows (9 columns for CSV). Sorted by departureAt then bookingRef ascending. |
| `BookingRevenueRow` | interface | `{ bookingRef, routeName, departureAt, buyerName, buyerPhone, ticketCount, totalVnd, paymentMethod, status }` |
| `GetBookingRevenueRowsInput` | interface | `{ operatorId, dateFrom, dateTo, routeId? }` |

### `getPayoutReport.ts`

| Export | Kind | Description |
|---|---|---|
| `getPayoutReport(input)` | async function | Lists all Payout rows for an operator, newest first. Handles null tripId for withdrawal payouts (renders "Rut tien (Withdrawal)" label). |
| `PayoutReportRow` | interface | `{ tripId?, routeName, departureAt?, payoutId, gross, platformFee, net, status, scheduledAt, settledAt?, failureReason? }` |
| `GetPayoutReportInput` | interface | `{ operatorId }` |

### `buildRevenueCsv.ts`

| Export | Kind | Description |
|---|---|---|
| `buildRevenueCsv(rows)` | function | Builds UTF-8 BOM CSV string from `RevenueRow[]`. Vietnamese headers. CRLF line endings. Formula injection prevention. Dates in Asia/Ho_Chi_Minh timezone. |
| `RevenueRow` | interface | `{ tripId, departureAt, routeName, seatsSold, grossRevenueVnd, platformFeeVnd, netPayoutVnd, payoutStatus }` |

### `buildBookingRevenueCsv.ts`

| Export | Kind | Description |
|---|---|---|
| `buildBookingRevenueCsv(rows)` | function | Builds UTF-8 BOM CSV string from `BookingRevenueRow[]`. English headers (PRD story 57). Phone numbers wrapped as `="<phone>"` for Excel text preservation. |
| `BookingRevenueRow` | type (re-export) | Re-exported from `getBookingRevenueRows.ts` |

### `index.ts` (Barrel)

Re-exports all public symbols from the domain. Notable: 103 lines of exports covering all files above.

---

## Concurrency Patterns

| Operation | Lock Target | Mechanism |
|---|---|---|
| `requestWithdrawal` | `Operator` row | `SELECT id FROM "Operator" WHERE id = $1 FOR UPDATE` inside `$transaction(async (tx) => ...)` (callback form). Serializes concurrent withdrawals per operator. |
| `retryPayout` | `Payout` row | `SELECT ... FROM "Payout" WHERE id = $1 FOR UPDATE` inside `$transaction`. |
| `recordChargeback` | None (idempotency-based) | Layer-1 existence probe on `chargeback:<key>` + per-leg P2002 idempotency inside one `$transaction`. |
| `refundOut` | None (idempotency-based) | Layer-1 existence probe on `refund_out:<key>` + per-leg P2002 idempotency. PSP call before ledger writes. |

All transactional operations use the **callback form** of `$transaction` (not the array form), which provides a `tx` handle for raw SQL.

---

## Fee Configuration Model

Rates are stored as **parts-per-million (ppm) integers**: `60000 ppm = 6%`.

Resolution order in `getEffectiveFeeRate`:
1. Per-operator override rows matching `operatorId` + `atTime` window -- latest `effectiveFrom` wins.
2. Global default rows (`operatorId = null`) matching `atTime` window -- fallback if no override exists.

Fee changes are **always new rows** (effective-dated, never edited in place). Prior open rows are closed (`effectiveTo = effectiveFrom`) for tidiness but this is optional for correctness.

Upper bound: `MAX_FEE_OVERRIDE_PPM` = `MAX_GLOBAL_FEE_PPM` = `200_000` (20%).

---

## Test Files

| Test File | Type | Covers |
|---|---|---|
| `__tests__/ledgerRepo.test.ts` | Unit | `appendLedgerEntry` idempotency, BigInt coercion |
| `__tests__/balance.test.ts` | Unit | `getOperatorBalance` bucket logic |
| `__tests__/calcPayout.test.ts` | Unit | `calcPayout`, `halfEvenRound`, BigInt math parity |
| `__tests__/feeConfig.test.ts` | Unit | `getEffectiveFeeRate`, `applyFeePpm`, `calcPlatformFeeMinor` |
| `__tests__/refund.test.ts` | Unit | `refundOut` double-entry, idempotency |
| `__tests__/chargeback.test.ts` | Unit | `recordChargeback` pre/post-payout signs, backstop |
| `__tests__/withdrawal.test.ts` | Unit | `requestWithdrawal` validation, idempotency |
| `__tests__/setGlobalFee.test.ts` | Unit | `setGlobalFee` validation, prior-row close |
| `__tests__/setOperatorFeeOverride.test.ts` | Unit | `setOperatorFeeOverride` validation |
| `__tests__/addManualAdjustment.test.ts` | Unit | `addManualAdjustment` validation, audit |
| `__tests__/buildRevenueCsv.test.ts` | Unit | CSV output format, formula injection, BOM |
| `__tests__/buildBookingRevenueCsv.test.ts` | Unit | Per-booking CSV, phone wrapping |
| `__tests__/ledgerImmutability.int.test.ts` | Integration | DB trigger blocks UPDATE/DELETE |
| `__tests__/ledgerCreditFee.int.test.ts` | Integration | Booking credit + platform fee ledger writes |
| `__tests__/chargeback.int.test.ts` | Integration | End-to-end chargeback with real DB |
| `__tests__/refundOut.int.test.ts` | Integration | End-to-end refund with real DB |
| `__tests__/retryPayout.int.test.ts` | Integration | Payout retry state transitions |
| `__tests__/withdrawal.int.test.ts` | Integration | Withdrawal with real balance + FOR UPDATE |

---

## Key Architectural Decisions

1. **Derived balance, not stored** -- No mutable balance column. Always SUM over immutable ledger. Eliminates drift and race conditions on the balance value itself.

2. **Double-entry for refunds** -- `refund_debit` (operator balance) + `refund_out` (platform float) as separate entries with different balance-inclusion semantics prevents double-counting.

3. **Post-payout chargeback model** -- `payout_reversal` (+amount) + `chargeback` (-2*amount) = NET -amount. The reversal reclaims disbursed cash; the chargeback removes both the original credit and the reclaimed amount.

4. **Platform bad-debt backstop** -- When operator available balance is insufficient to cover a chargeback, the shortfall is recorded as a positive `adjustment` entry keyed `chargeback_backstop:<key>`, flooring operator liability at their available balance.

5. **Sweep-aligned withdrawal debit** -- Withdrawal's `payout_debit` uses the same sourceEventId pattern (`payout_debit:<payoutId>`) as the auto-sweep, so the sweep's later append is a P2002 no-op. Prevents double-debit.

6. **Effective-dated fees** -- FeeConfig rows are never edited. New rates are new rows. `getEffectiveFeeRate` resolves the winner at any point in time.
