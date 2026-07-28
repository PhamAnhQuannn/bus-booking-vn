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
  net: bigint;
}

/**
 * Bound the work one tick claims (#364), mirroring reconcilePayments' CLAIM_LIMIT.
 *
 * FOR UPDATE SKIP LOCKED stops concurrent invocations double-claiming, but it does not
 * bound how many rows ONE tick takes. A completion spike (holiday weekend, T+3 alignment)
 * could due hundreds of payouts into a single long-held transaction — and the whole tick
 * runs inside one $transaction under the job advisory lock, so that lock is held for the
 * entire batch. It gets worse the moment settlePayout stops being a no-network stub.
 *
 * A bounded budget is only safe if every row it claims can actually PROGRESS. The
 * unverified-account guard below skips its row without changing `status` or
 * `scheduledAt`, so a skipped payout stays permanently in the candidate set — and
 * `ORDER BY scheduledAt ASC` sorts the oldest, most-stuck rows FIRST. One operator who
 * never verifies their account and accumulates CLAIM_LIMIT due payouts would therefore
 * consume the entire budget every tick, forever, and every other operator's genuinely
 * due payouts would never be reached. `rowsAffected` would read 0 — indistinguishable
 * from idle. That is the 2026-07-24 "permanent hold starves a bounded work queue"
 * pattern from the mistake log, and adding the LIMIT is what would have armed it.
 *
 * So the candidate query excludes unpayable rows in SQL rather than claiming and then
 * skipping them. The JS guard stays as a race-guard (verification can be revoked between
 * the SELECT and the update), and the stuck rows are counted separately so they remain
 * observable instead of becoming invisible.
 */
const CLAIM_LIMIT = 200;

export const processPayouts: JobCore = async (tx, opts) => {
  const now = opts?.now ?? new Date();

  // EXISTS, not a join: only "Payout" is in the FROM list, so FOR UPDATE locks exactly
  // the rows this tick claims and nothing in "PayoutAccount".
  const due = await tx.$queryRaw<DuePayout[]>(
    Prisma.sql`
      SELECT p.id, p."operatorId", p.net
      FROM "Payout" p
      WHERE p.status = 'requested'::"PayoutStatus"
        AND p."scheduledAt" <= NOW()
        AND EXISTS (
          SELECT 1 FROM "PayoutAccount" pa
          WHERE pa."operatorId" = p."operatorId"
            AND pa."verifiedAt" IS NOT NULL
        )
      ORDER BY p."scheduledAt" ASC
      LIMIT ${CLAIM_LIMIT}
      FOR UPDATE SKIP LOCKED
    `
  );

  // Due but unpayable — deliberately NOT claimed above (see CLAIM_LIMIT). Counted so the
  // backlog stays visible: excluding these rows from the budget is what keeps the sweeper
  // live, but it would otherwise make a stuck operator silently invisible, which is how
  // the starvation this guards against would have gone unnoticed in the first place.
  const [blocked] = await tx.$queryRaw<{ count: bigint }[]>(
    Prisma.sql`
      SELECT COUNT(*) AS count
      FROM "Payout" p
      WHERE p.status = 'requested'::"PayoutStatus"
        AND p."scheduledAt" <= NOW()
        AND NOT EXISTS (
          SELECT 1 FROM "PayoutAccount" pa
          WHERE pa."operatorId" = p."operatorId"
            AND pa."verifiedAt" IS NOT NULL
        )
    `
  );
  const blockedCount = Number(blocked?.count ?? 0);
  if (blockedCount > 0) {
    logger.warn(
      { blockedCount },
      'processPayouts.due_but_payout_account_unverified'
    );
  }

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
    // Issue 078: only send to a verified payout account. Unverified → skip, leaving the
    // row `requested` for a later sweep (no status change, no debit).
    //
    // Now a RACE-guard rather than the primary filter: the candidate query already
    // excludes unverified accounts, so this only fires if verification was revoked
    // between that SELECT and here. Kept because the consequence of getting it wrong is
    // paying money to an unverified account.
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
      // CHECK-THEN-APPEND (Issue 053 fix): on-demand withdrawals pre-write
      // `payout_debit:<payoutId>` at request time to drain `available` immediately.
      // Blindly re-appending the same sourceEventId here would raise a unique
      // violation — and because we are INSIDE this enclosing $transaction, Postgres
      // aborts the WHOLE transaction (25P02) and appendLedgerEntry's P2002 re-read
      // cannot run in an aborted tx, so the settlement rolls back and the payout is
      // stranded `requested` forever. The job holds a run-lock (advisory lock) and
      // the withdrawal's debit was committed before this sweep, so a serial
      // check-then-append is race-free: write the debit only if it does not yet
      // exist. amountMinor passed as a bigint to stay in the BigInt domain (Issue 016).
      const debitKey = `payout_debit:${payout.id}`;
      const existingDebit = await tx.ledgerEntry.findUnique({
        where: { sourceEventId: debitKey },
        select: { id: true },
      });
      if (!existingDebit) {
        await appendLedgerEntry(
          {
            operatorId: payout.operatorId,
            payoutId: payout.id,
            type: 'payout_debit',
            amountMinor: -payout.net,
            sourceEventId: debitKey,
          },
          tx
        );
      }
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

  // Issue 078: a skipped payout is left `requested` for retry — it does not count toward
  // rowsAffected (nothing was settled). Post-#364 this should be ~0, since the candidate
  // query pre-filters; a non-zero value means verification was revoked mid-tick, which is
  // worth seeing on its own rather than folded into the backlog warning above.
  if (skipped > 0) {
    logger.info({ skipped, processed }, 'processPayouts.skipped_unverified_payout_account');
  }

  return { rowsAffected: processed, status: 'success' };
};
