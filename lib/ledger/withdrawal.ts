/**
 * requestWithdrawal — on-demand operator withdrawal (Issue 053). MONEY-CRITICAL.
 *
 * The operator pulls their own `available` net balance out of the platform float
 * via a Payout row that flows through the SAME state machine (requested →
 * processing → paid|failed) as the auto-sweep (Issue 050). A withdrawal is NOT
 * trip-scoped: tripId = null, no platform fee (the fee was already taken at the
 * booking_credit/platform_fee stage — a withdrawal moves already-net money).
 *
 * ── CONCURRENCY (Issue 011 Mistake Log) ──────────────────────────────────────
 * Two concurrent withdrawals could each read the same `available` and both pass
 * the gate, double-spending the balance (classic TOCTOU: read SUM → write Payout).
 * The operator balance is DERIVED (not a stored column), so there is no balance
 * row to lock — we serialise on the OPERATOR row instead:
 *   SELECT id FROM "Operator" WHERE id = $1 FOR UPDATE   (callback-form $transaction)
 * Every withdrawal for one operator takes this row lock first, so the available
 * recompute + the Payout/ledger write are atomic per operator. The recompute runs
 * UNDER THE LOCK using the tx handle (NOT the global prisma) so it sees the state
 * the lock guards. CUIDs are TEXT — no ::uuid cast (Issue 011).
 *
 * ── DOUBLE-DEBIT IDEMPOTENCY (the subtle correctness point) ───────────────────
 * The auto-sweep (processPayouts, Issue 050) writes a `payout_debit` ledger entry
 * keyed `payout_debit:<payoutId>` on the requested→paid transition. If the
 * withdrawal wrote ITS payout_debit under a DIFFERENT key (e.g.
 * `withdraw:<idempotencyKey>`), then when the sweep later pays the withdrawal
 * Payout it would append a SECOND payout_debit → DOUBLE DEBIT of the same money.
 *
 * FIX: the withdrawal writes its payout_debit under the EXACT key the sweep uses:
 *   sourceEventId = `payout_debit:<newPayoutId>`
 * appendLedgerEntry is idempotent on sourceEventId (swallows P2002 → no-op). So
 * when processPayouts later pays this withdrawal Payout and tries to append
 * `payout_debit:<payoutId>`, the row already exists → P2002 → no second entry.
 * Exactly ONE payout_debit per payout, written at request time, re-confirmed
 * (idempotently) at sweep time. The balance drains immediately on request (the
 * operator can't re-withdraw the same money) and is never drained twice.
 *
 * ── REQUEST-LEVEL IDEMPOTENCY (replay safety) ─────────────────────────────────
 * The sweep-aligned payout_debit is keyed `payout_debit:<payoutId>` — but on a
 * fresh request we don't know the payoutId yet, so we can't probe THAT key to
 * detect a replay. We therefore also write a balance-neutral MARKER ledger entry
 * keyed by the CALLER's idempotencyKey: `withdraw-key:<idempotencyKey>` (a
 * zero-amount `adjustment` carrying the new payoutId).
 *   • Layer 1 (pre-tx): probe `withdraw-key:<key>`. If present → return its
 *     payoutId, write nothing (replay short-circuit).
 *   • Layer 2 (in-tx, under the FOR UPDATE lock): re-probe the marker. Two
 *     concurrent same-key requests both miss Layer 1; the lock serialises them and
 *     the second sees the first's marker here → returns the same payoutId, no
 *     duplicate Payout.
 *
 * ── ARITHMETIC (Issue 016) ───────────────────────────────────────────────────
 * All money math stays in the BigInt domain. ES2017 target → BigInt() constructor,
 * never the `n` literal suffix.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';
import { appendLedgerEntry } from './ledgerRepo';
import { OPERATOR_BALANCE_TYPES } from './balance';
import { MIN_WITHDRAW_THRESHOLD_VND, SETTLEMENT_DELAY_SQL_INTERVAL } from './constants';
import { isPayoutAccountVerified } from '@/lib/onboarding';
import { logger } from '@/lib/logger';
import type { LedgerEntryType } from '@prisma/client';

export interface RequestWithdrawalInput {
  operatorId: string;
  /** Withdrawal amount in VND minor units (integer, positive). */
  amountMinor: number;
  /**
   * Caller-supplied idempotency key (e.g. an Idempotency-Key header value, or a
   * server-minted per-request uuid). Replaying the SAME key returns the SAME
   * payoutId and writes nothing new — no double withdrawal.
   */
  idempotencyKey: string;
}

export type RequestWithdrawalResult =
  | { ok: true; payoutId: string }
  | {
      ok: false;
      reason:
        | 'below_min'
        | 'insufficient_available'
        | 'invalid_amount'
        // Issue 078: the payout rail only sends to a VERIFIED payout account. A
        // missing or unverified PayoutAccount blocks the withdrawal — the operator
        // must register + verify ownership before pulling funds.
        | 'payout_account_unverified';
    };

/** Marker sourceEventId for request-level (idempotencyKey) replay short-circuit. */
function withdrawMarkerKey(idempotencyKey: string): string {
  return `withdraw-key:${idempotencyKey}`;
}

/**
 * Recompute the operator's `available` balance UNDER THE LOCK using the tx handle.
 *
 * MUST match getOperatorBalance().available exactly (lib/ledger/balance.ts):
 *   available = settledEligible − paidOut
 * where settledEligible sums non-payout OPERATOR_BALANCE_TYPES rows on a completed
 * trip past T+1, and paidOut is the magnitude of payout_debit rows. We inline the
 * same SQL here (rather than calling getOperatorBalance, which uses the GLOBAL
 * client) so the read participates in the FOR UPDATE transaction.
 */
async function availableUnderLock(
  tx: Prisma.TransactionClient,
  operatorId: string
): Promise<bigint> {
  const balanceTypes = Prisma.join(
    OPERATOR_BALANCE_TYPES.map((t) => Prisma.sql`${t}::"LedgerEntryType"`)
  );
  const rows = await tx.$queryRaw<{ available: string }[]>`
    SELECT (
      COALESCE(SUM(
        CASE
          WHEN le."type" NOT IN ('payout_debit'::"LedgerEntryType", 'tax_withheld'::"LedgerEntryType")
           AND t."completedAt" IS NOT NULL
           AND t.status = 'completed'::"TripStatus"
           AND t."completedAt" + (${SETTLEMENT_DELAY_SQL_INTERVAL})::interval <= NOW()
          THEN le."amount"
          ELSE 0
        END
      ), 0)
      -- minus everything already paid out (payout_debit stored negative → add it,
      -- i.e. settledEligible + SUM(payout_debit) == settledEligible − paidOut).
      + COALESCE(SUM(
        CASE
          WHEN le."type" IN ('payout_debit'::"LedgerEntryType", 'tax_withheld'::"LedgerEntryType")
          THEN le."amount"
          ELSE 0
        END
      ), 0)
    )::text AS available
    FROM "LedgerEntry" le
    LEFT JOIN "Booking" b ON b.id = le."bookingId"
    LEFT JOIN "Trip" t ON t.id = b."tripId"
    WHERE le."operatorId" = ${operatorId}
      AND le."type" IN (${balanceTypes})
  `;
  return BigInt(rows[0]?.available ?? '0');
}

/**
 * Request an on-demand withdrawal of `amountMinor` from the operator's available
 * balance. See file header for the concurrency + double-debit idempotency model.
 */
export async function requestWithdrawal(
  input: RequestWithdrawalInput
): Promise<RequestWithdrawalResult> {
  const { operatorId, amountMinor, idempotencyKey } = input;

  // 1. Validate. amountMinor must be a positive integer ≥ the withdrawal floor.
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return { ok: false, reason: 'invalid_amount' };
  }
  if (amountMinor < MIN_WITHDRAW_THRESHOLD_VND) {
    return { ok: false, reason: 'below_min' };
  }

  // 2. Layer-1 idempotency: a prior withdrawal with this idempotencyKey wrote a
  //    `withdraw-key:<key>` marker carrying its payoutId. If present, replay →
  //    return the same payoutId, write nothing.
  const markerKey = withdrawMarkerKey(idempotencyKey);
  const existingMarker = await prisma.ledgerEntry.findUnique({
    where: { sourceEventId: markerKey },
    select: { payoutId: true },
  });
  if (existingMarker?.payoutId) {
    logger.info(
      { operatorId, idempotencyKey, payoutId: existingMarker.payoutId },
      'withdrawal.replay — short-circuit, returning prior payoutId'
    );
    return { ok: true, payoutId: existingMarker.payoutId };
  }

  const amount = BigInt(amountMinor);

  // 3. Atomic per-operator: lock the Operator row, recompute available UNDER the
  //    lock, gate, then create the Payout + payout_debit + marker.
  const result = await prisma.$transaction(async (tx) => {
    // SELECT ... FOR UPDATE on the Operator row serialises concurrent withdrawals
    // for this operator (the balance is derived, so the Operator row is the gate).
    // CUIDs are TEXT — no ::uuid cast (Issue 011 Mistake Log).
    await tx.$queryRaw`SELECT id FROM "Operator" WHERE id = ${operatorId} FOR UPDATE`;

    // Re-probe the marker UNDER the lock. Two concurrent requests with the SAME
    // idempotencyKey both pass the pre-tx Layer-1 probe (neither marker exists
    // yet), then serialise on the FOR UPDATE above. The FIRST writes the marker;
    // the SECOND now sees it here and returns the SAME payoutId without creating a
    // duplicate Payout. (Without this in-lock re-probe the second would create a
    // second Payout and only the marker append would dedup — leaving an orphan
    // requested Payout.)
    const lockedMarker = await tx.ledgerEntry.findUnique({
      where: { sourceEventId: markerKey },
      select: { payoutId: true },
    });
    if (lockedMarker?.payoutId) {
      return { ok: true as const, payoutId: lockedMarker.payoutId };
    }

    // Issue 078: the payout rail only sends to a VERIFIED payout account. Block the
    // withdrawal when the operator has no registered PayoutAccount or it is not yet
    // verified (verifiedAt is null — e.g. after an account edit re-armed
    // verification). Checked UNDER the lock with the tx handle so it is consistent
    // with the rest of the gated writes. No Payout, no ledger entries on this path.
    if (!(await isPayoutAccountVerified(tx, operatorId))) {
      return { ok: false as const, reason: 'payout_account_unverified' as const };
    }

    // Recompute available UNDER the lock with the tx handle — same definition as
    // getOperatorBalance().available.
    const available = await availableUnderLock(tx, operatorId);

    if (available < amount) {
      // Abort: no Payout, no ledger writes. Reason surfaced to the route as 422.
      return { ok: false as const, reason: 'insufficient_available' as const };
    }

    // Create the (requested) Payout — NOT trip-scoped (tripId = null), no platform
    // fee on a withdrawal (the money is already net). scheduledAt = now so the
    // sweep picks it up on its next run.
    const payout = await tx.payout.create({
      data: {
        tripId: null,
        operatorId,
        gross: amountMinor,
        platformFee: 0,
        net: amountMinor,
        status: 'requested',
        scheduledAt: new Date(),
      },
      select: { id: true },
    });

    // The balance-drain leg. KEY MUST MATCH the sweep's key (`payout_debit:<id>`)
    // so processPayouts' later append is a P2002 no-op — exactly one payout_debit
    // per payout (file header: DOUBLE-DEBIT IDEMPOTENCY). amount is −withdrawal.
    await appendLedgerEntry(
      {
        operatorId,
        payoutId: payout.id,
        type: 'payout_debit' satisfies LedgerEntryType,
        amountMinor: -amount,
        sourceEventId: `payout_debit:${payout.id}`,
      },
      tx
    );

    // Request-level replay marker: a zero-amount adjustment carrying the payoutId,
    // keyed by the caller's idempotencyKey. A future call with the same key finds
    // this via the Layer-1 probe and returns payout.id without re-withdrawing.
    // amount 0 → balance-neutral (adjustment counts in the balance but +0 is inert).
    await appendLedgerEntry(
      {
        operatorId,
        payoutId: payout.id,
        type: 'adjustment' satisfies LedgerEntryType,
        amountMinor: BigInt(0),
        sourceEventId: markerKey,
      },
      tx
    );

    return { ok: true as const, payoutId: payout.id };
  });

  if (result.ok) {
    logger.info(
      { operatorId, idempotencyKey, payoutId: result.payoutId, amountMinor },
      'withdrawal.requested'
    );
  } else {
    logger.info({ operatorId, idempotencyKey, amountMinor }, 'withdrawal.insufficient_available');
  }

  return result;
}
