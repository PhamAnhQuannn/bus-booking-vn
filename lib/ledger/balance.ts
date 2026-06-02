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
 * ── BUCKET SQL (documented) ─────────────────────────────────────────────────
 * A single aggregate joins LedgerEntry → Booking → Trip (LEFT joins so entries
 * with no booking/trip still aggregate) and classifies each row with a CASE on
 * the entry type and the trip's completion + T+1 window:
 *
 *   • payout_debit rows          → paid_out bucket (negated to positive total)
 *   • every OTHER (non-payout)   → settlement-eligible IF the linked trip is
 *     row                          completed AND `completedAt + interval '1 day'
 *                                  <= NOW()`; ELSE pending.
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

import { prisma } from '@/lib/db/client';
import { SETTLEMENT_DELAY_SQL_INTERVAL } from './constants';

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
  // Interval is a server-controlled constant ('1 day'); operatorId is bound.
  const rows = await prisma.$queryRaw<BalanceRow[]>`
    SELECT
      -- settlement-eligible: non-payout entries on a completed trip past T+1.
      COALESCE(SUM(
        CASE
          WHEN le."type" <> 'payout_debit'::"LedgerEntryType"
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
          WHEN le."type" <> 'payout_debit'::"LedgerEntryType"
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
          WHEN le."type" = 'payout_debit'::"LedgerEntryType"
          THEN le."amount"
          ELSE 0
        END
      ), 0)::text AS paid_out
    FROM "LedgerEntry" le
    LEFT JOIN "Booking" b ON b.id = le."bookingId"
    LEFT JOIN "Trip" t ON t.id = b."tripId"
    WHERE le."operatorId" = ${operatorId}
  `;

  const row = rows[0];
  const settledEligible = BigInt(row?.settled_eligible ?? '0');
  const pending = BigInt(row?.pending_sum ?? '0');
  const paidOut = BigInt(row?.paid_out ?? '0');

  // available = everything settlement-eligible minus everything already paid out.
  const available = settledEligible - paidOut;

  return { pending, available, paidOut };
}
