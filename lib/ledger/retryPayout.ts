/**
 * retryPayout — transition a failed Payout to 'processing' for re-attempt.
 *
 * TOCTOU-safe: uses SELECT FOR UPDATE on the Payout row inside $transaction (callback form).
 * Issue 011 Mistake Log: callback form provides tx handle for raw SQL; CUIDs are TEXT (no ::uuid cast).
 * Issue 013 Mistake Log: discriminated result for the not_failed idempotent guard — NOT a thrown sentinel.
 *
 * I7-exempt: operator-only mutation; no client-originated amount.
 */

import { prisma } from '@/lib/core/db/client';
import type { Payout } from '@prisma/client';

export type RetryPayoutResult =
  | { ok: true; payout: Payout }
  | { ok: false; error: 'not_found' | 'wrong_operator' | 'not_failed' };

export async function retryPayout(input: {
  payoutId: string;
  operatorId: string;
}): Promise<RetryPayoutResult> {
  const { payoutId, operatorId } = input;

  return prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE serialises concurrent retries on the same payout row.
    // CUIDs are TEXT — no ::uuid cast needed.
    const rows = await tx.$queryRaw<
      Array<{ id: string; operatorId: string; status: string }>
    >`SELECT id, "operatorId", status FROM "Payout" WHERE id = ${payoutId} FOR UPDATE`;

    if (rows.length === 0) {
      return { ok: false, error: 'not_found' };
    }

    // Existence-hiding for cross-tenant IDOR (Issue 011/013 Mistake Log: 404 for wrong-owner).
    if (rows[0].operatorId !== operatorId) {
      return { ok: false, error: 'wrong_operator' };
    }

    // Only 'failed' payouts can be retried. All other statuses (requested, processing, paid)
    // are not eligible — use discriminated result, not a thrown sentinel (Issue 013 Mistake Log).
    if (rows[0].status !== 'failed') {
      return { ok: false, error: 'not_failed' };
    }

    const updated = await tx.payout.update({
      where: { id: payoutId },
      data: {
        status: 'processing',
        failureReason: null,
      },
    });

    return { ok: true, payout: updated };
  });
}
