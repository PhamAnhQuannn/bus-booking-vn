/**
 * processRefunds — JobCore that drives due RefundObligation rows to completion via refundOut,
 * with retry + exponential backoff (#569, SEC-REFUND-DURABILITY).
 *
 * Obligations are ENQUEUED inside the paid transaction (lib/payment/processWebhook.ts) with
 * status='pending' — durable by construction. This cron is the single execution path, replacing
 * the old best-effort `after()` refund blocks. refundOut is ledger-idempotent (short-circuits on an
 * existing refund_out:<idempotencyKey> row), so re-driving a row can never double-refund.
 *
 * Claim-then-execute outbox pattern (mirrors dispatchNotifications): claim a batch with
 * FOR UPDATE SKIP LOCKED in a short tx, then call refundOut OUTSIDE any transaction (it opens its
 * own), and persist the per-row outcome. The advisory lock ('process-refunds') serialises whole
 * ticks; SKIP LOCKED covers a manual trigger racing a scheduled tick.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';
import { refundOut, type RefundReason } from '@/lib/payment';
import { logger } from '@/lib/logger';
import { captureException } from '@/lib/observability';
import type { JobCore, JobOpts } from './types';

/** Max refund attempts before a row is left permanently failed (not reclaimed). */
export const MAX_REFUND_ATTEMPTS = 5;
/** How many due obligations to drive per cron tick. */
export const REFUND_BATCH_SIZE = 25;
const BACKOFF_CAP_MINUTES = 30;

/** Exponential backoff: attempt N waits min(2^N, cap) minutes. Mirrors dispatchNotifications. */
export function refundBackoff(attemptCount: number, now: Date): Date {
  const minutes = Math.min(2 ** attemptCount, BACKOFF_CAP_MINUTES);
  return new Date(now.getTime() + minutes * 60_000);
}

interface DueRefund {
  id: string;
  bookingId: string;
  amountMinor: number;
  reason: string;
  idempotencyKey: string;
  attemptCount: number;
}

async function claimDue(now: Date, limit: number): Promise<DueRefund[]> {
  return prisma.$transaction(async (tx) => {
    return tx.$queryRaw<DueRefund[]>(Prisma.sql`
      SELECT "id", "bookingId", "amountMinor", "reason", "idempotencyKey", "attemptCount"
      FROM "RefundObligation"
      WHERE "status" IN ('pending', 'failed')
        AND "attemptCount" < ${MAX_REFUND_ATTEMPTS}
        AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `);
  });
}

export const processRefunds: JobCore = async (_tx, opts?: JobOpts) => {
  const now = opts?.now ?? new Date();
  const rows = await claimDue(now, REFUND_BATCH_SIZE);
  let done = 0;

  for (const row of rows) {
    try {
      // refundOut is idempotent (alreadyDone / manualRefundRequired both count as satisfied —
      // the ledger obligation is discharged; a no-PSP manual transfer is a separate ops task).
      await refundOut({
        bookingId: row.bookingId,
        amountMinor: row.amountMinor,
        reason: row.reason as RefundReason,
        idempotencyKey: row.idempotencyKey,
      });
      await prisma.refundObligation.update({
        where: { id: row.id },
        data: { status: 'done', attemptCount: row.attemptCount + 1, lastError: null, nextAttemptAt: null },
      });
      done += 1;
    } catch (err) {
      const nextAttempt = row.attemptCount + 1;
      await prisma.refundObligation.update({
        where: { id: row.id },
        data: {
          status: 'failed',
          attemptCount: nextAttempt,
          lastError: (err instanceof Error ? err.message : String(err)).slice(0, 500),
          // Once attemptCount reaches the cap the claim query stops reclaiming it → permanently failed.
          nextAttemptAt: refundBackoff(nextAttempt, now),
        },
      });
      logger.warn(
        { obligationId: row.id, bookingId: row.bookingId, reason: row.reason, attempt: nextAttempt },
        'payment.refund_obligation.failed'
      );
      // Alert — refund-out failure is real money owed to a rider. No PII in the context.
      captureException(err, { area: 'payment.refund', obligationId: row.id, reason: row.reason });
    }
  }

  return { rowsAffected: done, status: 'success' };
};
