/**
 * recordChargeback — bank / PayPal dispute (post-payout-capable) reversal.
 * MONEY-CRITICAL (Issue 052). S08/S13 ledger + S15#7 liability.
 *
 * A chargeback is a bank-initiated reversal of a paid booking. It can arrive at
 * any time, INCLUDING after the booking's revenue was already paid out to the
 * operator. Liability for the disputed funds rests with the OPERATOR (S15#7); the
 * PLATFORM acts as a bad-debt backstop ONLY for the portion the operator's
 * balance cannot cover. This function is the callable mechanism — wiring a real
 * PSP dispute webhook to it is deferred (see the comment at the bottom).
 *
 * ── BALANCE MODEL (lib/ledger/balance.ts) — read before touching signs ───────
 * `getOperatorBalance` sums OPERATOR_BALANCE_TYPES. `chargeback`, `payout_reversal`
 * and `adjustment` ALL count toward the operator balance; `payout_debit` is the
 * only one bucketed separately (paidOut). For the NET operator-balance figure
 *     B = pending + available + paidOut = SUM(every operator-balance row except
 *         payout_debit, whose +paidOut and −available legs cancel)
 * a `booking_credit (+amount)` for the disputed booking is STILL present in B
 * even after a payout (the payout drains `available`, not B). So the signed sum
 * of the entries we add IS the delta we impose on B. Pick signs accordingly.
 *
 * ── ENTRY SIGNS (EXACT — proven by the unit + int tests) ─────────────────────
 *
 *   PRE-PAYOUT  (the booking's credit was NOT yet paid out):
 *     chargeback = −amount                       → B delta = −amount
 *     (no payout_reversal — there is no completed payout to reverse.)
 *     The operator still holds the credit; clawing −amount directly makes them
 *     bear the dispute. Distinguishable in the ledger by the ABSENCE of a
 *     payout_reversal sibling.
 *
 *   POST-PAYOUT (the credit was already paid out — a `paid` Payout exists for
 *                the booking's trip, or a payout_debit row references it):
 *     payout_reversal = +amount                  → "the completed payout is being
 *                                                   reversed": the disbursed cash
 *                                                   is reclaimed back INTO the
 *                                                   operator's balance.
 *     chargeback      = −2 × amount               → removes BOTH the operator's
 *                                                   original booking revenue
 *                                                   (−amount, never legitimately
 *                                                   kept) AND the just-reclaimed
 *                                                   disbursed cash (−amount).
 *     ─────────────────────────────────────────────────────────────────────────
 *     NET = (+amount) + (−2·amount) = −amount     ← exactly one amount, NOT −2.
 *     ─────────────────────────────────────────────────────────────────────────
 *     The `payout_reversal` row is what makes the post-payout case DISTINGUISHABLE
 *     in the ledger from the pre-payout case (pre-payout never writes one). We do
 *     NOT write two −amount legs (chargeback −amount + payout_reversal −amount) —
 *     that would double-count to a −2·amount NET, the explicit anti-pattern.
 *
 * ── BACKSTOP (S15#7) — platform bad-debt for the un-coverable shortfall ──────
 * "Liability = operator, platform bad-debt backstop if balance insufficient."
 * DECISION (documented): the operator's balance is allowed to go NEGATIVE by the
 * full clawback (they genuinely owe it — chargeback/payout_reversal above are NOT
 * floored). SEPARATELY, when the operator's AVAILABLE balance (getOperatorBalance)
 * at clawback time is LESS than the clawback `amount`, the uncoverable shortfall
 *     shortfall = amount − max(available, 0)
 * is recorded as its OWN `adjustment` entry of +shortfall, keyed
 * `chargeback_backstop:<key>`. The +shortfall adjustment OFFSETS the operator's
 * un-coverable negative — i.e. it floors the operator's net liability at exactly
 * −available (what they could actually cover), and the platform "eats" the
 * +shortfall as its own bad-debt. The adjustment is operator-scoped purely for
 * traceability; it is tagged by its `chargeback_backstop:` sourceEventId prefix
 * so the future admin Finance tab can SUM platform bad-debt by querying that
 * prefix. (If available ≥ amount, no backstop entry is written.)
 *
 *   Net effect on the operator's B, post-everything (post-payout example):
 *     +amount (payout_reversal) − 2·amount (chargeback) + shortfall (backstop)
 *       = −amount + shortfall
 *       = −amount + (amount − available)            [when available < amount]
 *       = −available                                ← operator floored at −available
 *   The platform's bad-debt = shortfall = amount − available, tracked by the
 *   backstop adjustment row.
 *
 * ── IDEMPOTENCY (mirror refundOut) ───────────────────────────────────────────
 * One inbound `sourceEventId` (the dispute event id) derives up to THREE DISTINCT
 * ledger sourceEventIds:
 *     chargeback:<key>   payout_reversal:<key>   chargeback_backstop:<key>
 * Layer 1: before writing, we check whether `chargeback:<key>` already exists —
 *   if so, the dispute was already recorded → return { alreadyDone:true }, NO new
 *   rows, NO re-derivation. Layer 2: each appendLedgerEntry swallows P2002 on its
 *   unique sourceEventId, so even a race converges. All writes run inside one
 *   `$transaction` so a partial dispute can never leave one leg without the rest.
 *
 * ── ARITHMETIC (Issue 016) ───────────────────────────────────────────────────
 * All amount math stays in the BigInt domain. ES2017 target → BigInt() constructor,
 * never the `n` literal suffix (parser error). `2 × amount` is `amount * BigInt(2)`.
 */

import { prisma } from '@/lib/core/db/client';
import { appendLedgerEntry } from './ledgerRepo';
import { getOperatorBalance } from './balance';
import { logger } from '@/lib/logger';
import type { LedgerEntryType } from '@prisma/client';

export interface RecordChargebackInput {
  /** The disputed booking. Resolves operatorId + post-payout state. */
  bookingId: string;
  /** Disputed amount in VND minor units (integer, positive). */
  amountMinor: number;
  /**
   * Dispute-event idempotency key (e.g. the PSP dispute id). DISTINCT per dispute.
   * The (up to 3) ledger sourceEventIds are DERIVED from it:
   *   chargeback:<key>  payout_reversal:<key>  chargeback_backstop:<key>
   */
  sourceEventId: string;
}

export interface RecordChargebackResult {
  /** true iff this call wrote the chargeback (and its sibling) entries. */
  recorded: boolean;
  /** true iff the chargeback had already been recorded for this sourceEventId. */
  alreadyDone: boolean;
  /**
   * Platform bad-debt absorbed via the `chargeback_backstop:<key>` adjustment
   * (VND minor units, ≥ 0). 0 when the operator's available balance fully covered
   * the clawback. Undefined-safe: always a number on a recorded call, 0 on replay.
   */
  backstopped: number;
}

export class ChargebackError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'ChargebackError';
  }
}

/**
 * Minimal Prisma surface recordChargeback needs OUTSIDE the transaction:
 *  - booking lookup (operatorId via trip→bus, plus the trip id for payout check),
 *  - the layer-1 existence probe on `chargeback:<key>`,
 *  - the post-payout signal probes (Payout row status + payout_debit ledger row).
 * Injectable for unit tests; defaults to the shared singleton.
 */
export async function recordChargeback(
  input: RecordChargebackInput
): Promise<RecordChargebackResult> {
  const { bookingId, amountMinor, sourceEventId } = input;

  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new ChargebackError('invalid_amount');
  }

  const chargebackSourceId = `chargeback:${sourceEventId}`;
  const payoutReversalSourceId = `payout_reversal:${sourceEventId}`;
  const backstopSourceId = `chargeback_backstop:${sourceEventId}`;

  // 1. Resolve booking → operatorId + tripId (for the post-payout check).
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      tripId: true,
      trip: { select: { bus: { select: { operatorId: true } } } },
    },
  });
  if (!booking) throw new ChargebackError('booking_not_found');
  const operatorId = booking.trip.bus.operatorId;
  const tripId = booking.tripId;

  // 2. Layer-1 idempotency: if the chargeback row already exists for this key,
  //    the dispute was already recorded — short-circuit, write nothing.
  const existing = await prisma.ledgerEntry.findUnique({
    where: { sourceEventId: chargebackSourceId },
    select: { id: true },
  });
  if (existing) {
    logger.info(
      { bookingId, sourceEventId },
      'chargeback.already_done — short-circuit, no new entries'
    );
    return { recorded: false, alreadyDone: true, backstopped: 0 };
  }

  // 3. Post-payout detection (documented heuristic). The credit is "already paid
  //    out" when EITHER signal is present:
  //      (a) a `paid` Payout row exists for this booking's trip (payouts are
  //          per-trip — completeTripCore creates one Payout per completed trip),
  //      (b) a `payout_debit` LedgerEntry exists for this operator referencing
  //          that trip's payout (the balance-drain leg processPayouts writes on
  //          requested→paid, sourceEventId `payout_debit:<payoutId>`).
  //    (a) is the primary signal (it's the authoritative payout state); (b) is a
  //    belt-and-suspenders ledger cross-check covering any window where the row
  //    flipped to paid + the debit was written but before re-read. Either ⇒ post.
  const paidPayout = await prisma.payout.findFirst({
    where: { tripId, status: 'paid' },
    select: { id: true },
  });
  let postPayout = paidPayout !== null;
  if (!postPayout) {
    // Ledger cross-check: any payout_debit on a payout for this trip.
    const tripPayoutIds = (
      await prisma.payout.findMany({ where: { tripId }, select: { id: true } })
    ).map((p) => p.id);
    if (tripPayoutIds.length > 0) {
      const debit = await prisma.ledgerEntry.findFirst({
        where: { operatorId, type: 'payout_debit', payoutId: { in: tripPayoutIds } },
        select: { id: true },
      });
      postPayout = debit !== null;
    }
  }

  // 4. Backstop sizing (S15#7): read the operator's CURRENT available balance.
  //    The un-coverable shortfall is amount − max(available, 0). Read BEFORE the
  //    clawback writes (the clawback would itself drive available negative).
  const balanceBefore = await getOperatorBalance(operatorId);
  const availableCover =
    balanceBefore.available > BigInt(0) ? balanceBefore.available : BigInt(0);
  const amount = BigInt(amountMinor);
  const shortfall = amount > availableCover ? amount - availableCover : BigInt(0);

  // 5. Write all legs inside ONE transaction. Each is idempotent on its DISTINCT
  //    sourceEventId (appendLedgerEntry swallows P2002), so a race converges.
  await prisma.$transaction(async (tx) => {
    if (postPayout) {
      // POST-PAYOUT: payout_reversal (+amount) reclaims the disbursed cash;
      // chargeback (−2·amount) removes the original revenue + the reclaimed cash.
      // NET = −amount. The payout_reversal row distinguishes this from pre-payout.
      await appendLedgerEntry(
        {
          operatorId,
          bookingId,
          type: 'payout_reversal' satisfies LedgerEntryType,
          amountMinor: amount, // +amount — completed payout reversed back into balance
          sourceEventId: payoutReversalSourceId,
        },
        tx
      );
      await appendLedgerEntry(
        {
          operatorId,
          bookingId,
          type: 'chargeback' satisfies LedgerEntryType,
          amountMinor: -(amount * BigInt(2)), // −2·amount — revenue + reclaimed cash
          sourceEventId: chargebackSourceId,
        },
        tx
      );
    } else {
      // PRE-PAYOUT: single chargeback (−amount). Operator still holds the credit.
      await appendLedgerEntry(
        {
          operatorId,
          bookingId,
          type: 'chargeback' satisfies LedgerEntryType,
          amountMinor: -amount, // −amount — clawed straight off the held balance
          sourceEventId: chargebackSourceId,
        },
        tx
      );
    }

    // BACKSTOP (both cases): if the operator couldn't cover the clawback, record
    // the shortfall as a +shortfall adjustment that offsets their un-coverable
    // negative — flooring the operator at −available and tagging platform bad-debt.
    if (shortfall > BigInt(0)) {
      await appendLedgerEntry(
        {
          operatorId,
          bookingId,
          type: 'adjustment' satisfies LedgerEntryType,
          amountMinor: shortfall, // +shortfall — platform absorbs the un-coverable part
          sourceEventId: backstopSourceId,
        },
        tx
      );
    }
  });

  logger.info(
    {
      bookingId,
      sourceEventId,
      postPayout,
      amountMinor,
      backstopped: Number(shortfall),
    },
    'chargeback.recorded'
  );

  return { recorded: true, alreadyDone: false, backstopped: Number(shortfall) };
}

/**
 * listChargebacks — simple repo read of dispute-related ledger entries for the
 * future admin Finance tab (UI is Wave 3; this is just the data). Returns
 * chargeback + payout_reversal entries, plus the platform-bad-debt backstop
 * adjustments (identified by their `chargeback_backstop:` sourceEventId prefix —
 * `adjustment` is a general type, so we filter on the prefix to avoid sweeping in
 * unrelated manual adjustments). Newest first.
 *
 * @param operatorId optional filter; omit to list across all operators (admin).
 */
export interface DisputeEntry {
  id: string;
  operatorId: string;
  bookingId: string | null;
  type: LedgerEntryType;
  amount: bigint;
  currency: string;
  sourceEventId: string;
  createdAt: Date;
}

export async function listChargebacks(operatorId?: string): Promise<DisputeEntry[]> {
  const rows = await prisma.ledgerEntry.findMany({
    where: {
      ...(operatorId ? { operatorId } : {}),
      OR: [
        { type: 'chargeback' },
        { type: 'payout_reversal' },
        // platform bad-debt backstops are `adjustment` rows tagged by prefix.
        { type: 'adjustment', sourceEventId: { startsWith: 'chargeback_backstop:' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      operatorId: true,
      bookingId: true,
      type: true,
      amount: true,
      currency: true,
      sourceEventId: true,
      createdAt: true,
    },
  });
  return rows;
}

// FUTURE WIRING: a real PSP dispute webhook (Stripe `charge.dispute.created`,
// PayPal `CUSTOMER.DISPUTE.CREATED`, etc.) is deferred (PAYMENTS_STUB). When it
// lands, the verified webhook handler resolves the disputed booking and calls:
//   await recordChargeback({ bookingId, amountMinor, sourceEventId: dispute.id });
// using the PSP dispute id as the idempotency key so webhook retries are no-ops.
