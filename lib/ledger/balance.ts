/**
 * Operator balance derivation (Issue 050 Part B) — MONEY-CRITICAL.
 *
 * The operator's balance is NEVER a stored mutable column. It is always derived
 * as a SUM over the append-only, immutable LedgerEntry table (Issue 047), split
 * into three buckets:
 *
 *   pending   — revenue earned but not yet settlement-eligible: credit/fee/
 *               adjustment entries whose linked booking's trip is NOT yet
 *               completed, OR is completed but the T+1 settlement delay has not
 *               elapsed (the dispute/chargeback window, S15#5).
 *
 *   available — settlement-eligible balance the operator may withdraw NOW:
 *               the SUM of every non-payout entry whose linked trip is completed
 *               AND completed + T+1 has elapsed, MINUS everything already paid
 *               out. i.e. settledEligible − paidOut.
 *
 *   paidOut   — total already disbursed: −SUM(payout_debit). payout_debit rows
 *               are stored negative (debit FROM balance); we report the magnitude
 *               (a positive paid-out total).
 *
 * ── TYPE → OPERATOR-BALANCE INCLUSION (Issue 051, MONEY-CRITICAL) ────────────
 * Operator balance is NOT every ledger row for the operatorId. Some rows are
 * operatorId-scoped purely for TRACEABILITY but represent PLATFORM-FLOAT cash,
 * not operator-owed money. The explicit inclusion map:
 *
 *   booking_credit    COUNTS   (operator earns the fare)
 *   platform_fee      COUNTS   (platform's cut, a negative entry)
 *   refund_debit      COUNTS   (clawback of the operator's credit on a refund)
 *   payout_debit      COUNTS   (drains balance — but bucketed separately as paidOut)
 *   payout_reversal   COUNTS   (a failed payout restored to balance)
 *   chargeback        COUNTS   (bank-initiated reversal of operator revenue)
 *   adjustment        COUNTS   (manual correction, either direction)
 *   ───────────────────────────────────────────────────────────────────────────
 *   refund_out        EXCLUDED (PLATFORM-FLOAT: cash physically paid back to the
 *                              customer. It is paired with a refund_debit that
 *                              ALREADY claws the credit from the operator balance.
 *                              Counting refund_out too would DOUBLE-subtract.)
 *
 * `OPERATOR_BALANCE_TYPES` below is the single source of that inclusion set and
 * is injected into the bucket SQL as an explicit IN-list. This MUST be an
 * IN-list, NOT a `type <> 'payout_debit'` negation — a negation would silently
 * sweep `refund_out` (a non-payout type) into the operator balance and
 * double-subtract every refund. Add a NEW platform-float type → add it here.
 *
 * ── BUCKET SQL (documented) ─────────────────────────────────────────────────
 * A single aggregate joins LedgerEntry → Booking → Trip (LEFT joins so entries
 * with no booking/trip still aggregate) and classifies each row with a CASE on
 * the entry type and the trip's completion + T+1 window. Only rows whose type is
 * in OPERATOR_BALANCE_TYPES participate at all:
 *
 *   • payout_debit rows          → paid_out bucket (negated to positive total)
 *   • every OTHER operator-balance→ settlement-eligible IF the linked trip is
 *     type (credit/fee/refund_debit/  completed AND `completedAt + interval '1 day'
 *     reversal/chargeback/adjustment)  <= NOW()`; ELSE pending.
 *   • refund_out                 → NOT in the IN-list → excluded entirely.
 *
 *   available = settledEligibleSum − paidOut
 *
 * NULL-trip handling: a non-payout entry whose bookingId is NULL, or whose trip
 * is not completed, falls into `pending` (conservative — never prematurely
 * withdrawable). An adjustment tied to a booking inherits that booking's trip
 * completion state.
 *
 * ── ARITHMETIC ──────────────────────────────────────────────────────────────
 * Postgres SUM(BIGINT) returns NUMERIC; we COALESCE to 0 and cast ::text, then
 * parse with BigInt() so the value never round-trips through a JS number (Issue
 * 016 — no float drift in money math). All three returned values are bigint.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';
import { SETTLEMENT_DELAY_SQL_INTERVAL } from './constants';

/**
 * The EXPLICIT set of LedgerEntry types that count toward the OPERATOR balance
 * (Issue 051). `refund_out` is deliberately absent — it is platform-float cash,
 * already accounted for on the operator side by its paired `refund_debit`.
 * Injected into the bucket SQL as an IN-list (never a `<> payout_debit`
 * negation, which would leak refund_out in and double-subtract refunds).
 */
export const OPERATOR_BALANCE_TYPES = [
  'booking_credit',
  'platform_fee',
  'refund_debit',
  'payout_debit',
  'payout_reversal',
  'chargeback',
  'adjustment',
  'tax_withheld',
] as const;

export interface OperatorBalance {
  /** Earned but not yet settlement-eligible (trip not completed, or within T+1). */
  pending: bigint;
  /** Withdrawable now: settlement-eligible total minus everything already paid out. */
  available: bigint;
  /** Total already disbursed (positive magnitude of the payout_debit entries). */
  paidOut: bigint;
}

interface BalanceRow {
  settled_eligible: string;
  pending_sum: string;
  paid_out: string;
}

/**
 * Derive an operator's pending / available / paid-out balance from the ledger.
 *
 * Both operatorId and the settlement-delay interval are passed as BOUND
 * parameters in the tagged template (no string interpolation, no injection
 * surface). Postgres accepts a text param cast `($n)::interval`, so the trusted
 * '1 day' constant binds cleanly as `('1 day')::interval`.
 */
export async function getOperatorBalance(operatorId: string): Promise<OperatorBalance> {
  // Explicit operator-balance type IN-list (Issue 051): refund_out is EXCLUDED.
  // Built as cast enum literals bound through Prisma.join — no string splice.
  const balanceTypes = Prisma.join(
    OPERATOR_BALANCE_TYPES.map((t) => Prisma.sql`${t}::"LedgerEntryType"`)
  );
  // Interval is a server-controlled constant ('1 day'); operatorId is bound.
  const rows = await prisma.$queryRaw<BalanceRow[]>`
    SELECT
      -- settlement-eligible: non-payout entries on a completed trip past T+1.
      COALESCE(SUM(
        CASE
          WHEN le."type" NOT IN ('payout_debit'::"LedgerEntryType", 'tax_withheld'::"LedgerEntryType")
           AND t."completedAt" IS NOT NULL
           AND t.status = 'completed'::"TripStatus"
           AND t."completedAt" + (${SETTLEMENT_DELAY_SQL_INTERVAL})::interval <= NOW()
          THEN le."amount"
          ELSE 0
        END
      ), 0)::text AS settled_eligible,
      -- pending: non-payout entries NOT yet settlement-eligible.
      COALESCE(SUM(
        CASE
          WHEN le."type" NOT IN ('payout_debit'::"LedgerEntryType", 'tax_withheld'::"LedgerEntryType")
           AND NOT (
                 t."completedAt" IS NOT NULL
             AND t.status = 'completed'::"TripStatus"
             AND t."completedAt" + (${SETTLEMENT_DELAY_SQL_INTERVAL})::interval <= NOW()
           )
          THEN le."amount"
          ELSE 0
        END
      ), 0)::text AS pending_sum,
      -- paid out: magnitude of payout_debit (stored negative → negate to positive).
      COALESCE(-SUM(
        CASE
          WHEN le."type" IN ('payout_debit'::"LedgerEntryType", 'tax_withheld'::"LedgerEntryType")
          THEN le."amount"
          ELSE 0
        END
      ), 0)::text AS paid_out
    FROM "LedgerEntry" le
    LEFT JOIN "Booking" b ON b.id = le."bookingId"
    LEFT JOIN "Trip" t ON t.id = b."tripId"
    WHERE le."operatorId" = ${operatorId}
      -- Operator balance counts ONLY these types; refund_out (platform float)
      -- is intentionally excluded so the paired refund_debit isn't double-counted.
      AND le."type" IN (${balanceTypes})
  `;

  const row = rows[0];
  const settledEligible = BigInt(row?.settled_eligible ?? '0');
  const pending = BigInt(row?.pending_sum ?? '0');
  const paidOut = BigInt(row?.paid_out ?? '0');

  // available = everything settlement-eligible minus everything already paid out.
  const available = settledEligible - paidOut;

  return { pending, available, paidOut };
}
