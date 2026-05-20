/**
 * processPayouts — settle pending payouts whose T+3 scheduledAt has arrived
 * (Issue 019 AC5). Transitions each row pending → processing → settled (ok) or
 * processing → failed (settlement failure).
 *
 * Locks each due row (FOR UPDATE SKIP LOCKED) so concurrent invocations don't
 * double-settle. gross/platformFee/net were computed authoritatively at
 * Payout-row creation (completeTripCore, AC3) — this core only transitions
 * status and stamps settledAt / failureReason.
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
import { settlePayout } from '@/lib/payouts/settlePayout';
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
      WHERE status = 'pending'::"PayoutStatus"
        AND "scheduledAt" <= NOW()
      FOR UPDATE SKIP LOCKED
    `
  );

  let processed = 0;
  for (const payout of due) {
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
        data: { status: 'settled', settledAt: now },
      });
    } else {
      await tx.payout.update({
        where: { id: payout.id },
        data: { status: 'failed', failureReason: result.reason },
      });
    }

    processed += 1;
  }

  return { rowsAffected: processed, status: 'success' };
};
