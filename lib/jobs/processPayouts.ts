/**
 * processPayouts — settle requested payouts whose scheduledAt has arrived
 * (Issue 019 AC5). Transitions each row requested → processing → paid (ok) or
 * processing → failed (settlement failure).
 *
 * Issue 050 Part C: on the requested → paid transition we ALSO append a
 * `payout_debit` LedgerEntry (amount = −net) in the SAME transaction, so the
 * operator-balance SUM (lib/ledger/balance.ts) reflects the drain. Idempotent
 * via the ledger's sourceEventId unique key (`payout_debit:<payoutId>`).
 *
 * Locks each due row (FOR UPDATE SKIP LOCKED) so concurrent invocations don't
 * double-settle. gross/platformFee/net were computed authoritatively at
 * Payout-row creation (completeTripCore, AC3) — this core only transitions
 * status and stamps settledAt / failureReason.
 *
 * Issue 078: the payout rail only sends to a VERIFIED payout account. Before
 * settling a due row we check the operator's PayoutAccount is registered AND
 * verified (verifiedAt != null). If not, we SKIP the row — leave it `requested`
 * (do NOT mark it paid, do NOT write a payout_debit), so it is retried on a later
 * sweep once the operator verifies. A skip is not a failure: the money is still
 * owed, just not yet sendable.
 *
 * SPEC NOTE (Issue 019): the issue says the processor runs calcPayout; we
 * compute amounts at row-creation instead so the row carries them from birth.
 * The processor is status-only.
 *
 * V1 note: settlePayout is a no-network stub, safe inside the job transaction.
 * Real bank HTTP must move to claim-then-dispatch (commit 'processing' first,
 * call the network outside the tx) — see lib/jobs/withAdvisoryLock.ts.
 */

import { Prisma } from '@prisma/client';
import { settlePayout } from '@/lib/ledger';
import { captureException } from '@/lib/observability';
import { logger } from '@/lib/logger';
import type { JobCore } from './types';

interface DuePayout {
  id: string;
  operatorId: string;
  net: number;
}

export const processPayouts: JobCore = async (tx, opts) => {
  const now = opts?.now ?? new Date();

  const due = await tx.$queryRaw<DuePayout[]>(
    Prisma.sql`
      SELECT id, "operatorId", net
      FROM "Payout"
      WHERE status = 'requested'::"PayoutStatus"
        AND "scheduledAt" <= NOW()
      FOR UPDATE SKIP LOCKED
    `
  );

  // Lazy import keeps this core free of a module-level `@/lib/core/db/client` load:
  // unit tests that import the cron route (which imports this core) must not
  // trigger the eager `prisma` singleton (it throws without DATABASE_URL). We
  // pass `tx` to appendLedgerEntry, so its default-client param is never used.
  // Hoisted once (not per-iteration) before the loop.
  const { appendLedgerEntry } = await import('@/lib/ledger');
  // Issue 078: verified-account guard. Same lazy-import discipline so importing
  // this core in a unit test never eagerly loads the prisma singleton.
  const { isPayoutAccountVerified } = await import('@/lib/onboarding');

  let processed = 0;
  let skipped = 0;
  for (const payout of due) {
    // Issue 078: only send to a verified payout account. Unverified → skip,
    // leaving the row `requested` for a later sweep (no status change, no debit).
    if (!(await isPayoutAccountVerified(tx, payout.operatorId))) {
      skipped += 1;
      continue;
    }

    await tx.payout.update({
      where: { id: payout.id },
      data: { status: 'processing' },
    });

    const result = await settlePayout({
      payoutId: payout.id,
      operatorId: payout.operatorId,
      net: payout.net,
    });

    if (result.ok) {
      await tx.payout.update({
        where: { id: payout.id },
        data: { status: 'paid', settledAt: now },
      });

      // Issue 050 Part C: record the balance drain as an immutable ledger entry
      // in the SAME transaction as the status flip. amount = −net (debit FROM the
      // operator's balance; sign convention in lib/ledger/ledgerRepo.ts). The
      // operator-balance SUM (lib/ledger/balance.ts) reads this to compute paidOut.
      //
      // Idempotent: sourceEventId `payout_debit:<payoutId>` is unique, so a re-run
      // that re-selects the same row (it won't normally, since status is now 'paid'
      // and the WHERE filters on 'requested') is a no-op — belt-and-suspenders
      // alongside the status guard. amountMinor passed as a bigint to stay in the
      // BigInt domain (Issue 016).
      await appendLedgerEntry(
        {
          operatorId: payout.operatorId,
          payoutId: payout.id,
          type: 'payout_debit',
          amountMinor: -BigInt(payout.net),
          sourceEventId: `payout_debit:${payout.id}`,
        },
        tx
      );
    } else {
      await tx.payout.update({
        where: { id: payout.id },
        data: { status: 'failed', failureReason: result.reason },
      });
      // Issue 061 (AC5): alert on a failed payout settlement. Additive +
      // non-throwing; the status='failed' write + loop flow are unchanged.
      captureException(new Error(`payout_settlement_failed: ${result.reason}`), {
        area: 'payout',
        payoutId: payout.id,
        reason: result.reason,
      });
    }

    processed += 1;
  }

  // Issue 078: a skipped (unverified-account) payout is left `requested` for retry —
  // surface the count so an operator stuck unverified is observable, but it does not
  // count toward rowsAffected (nothing was settled for those).
  if (skipped > 0) {
    logger.info({ skipped, processed }, 'processPayouts.skipped_unverified_payout_account');
  }

  return { rowsAffected: processed, status: 'success' };
};
