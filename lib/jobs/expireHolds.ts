/**
 * expireHolds — sweep active holds past their expiresAt and flip them to
 * 'expired' (Issue 019 AC1). Extracted from the sweep-holds cron route so the
 * same SQL runs under the advisory-lock + JobRunLog wrapper.
 *
 * SPEC NOTE (Issue 019): the issue text references a Trip.activeHolds counter —
 * no such column exists. Capacity is derived from active holds + paid bookings
 * (_count); expiring a hold only flips Hold.status, and capacity release is
 * automatic on the next capacity read. No counter to decrement here.
 *
 * Batched (LIMIT) + FOR UPDATE SKIP LOCKED so concurrent invocations don't
 * fight over the same rows.
 */

import { Prisma } from '@prisma/client';
import type { JobCore } from './types';

const BATCH_LIMIT = 500;

export const expireHolds: JobCore = async (tx) => {
  const expired = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      WITH expired AS (
        SELECT id FROM "Hold"
        WHERE status = 'active'::"HoldStatus"
          AND "expiresAt" < NOW()
        LIMIT ${BATCH_LIMIT}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "Hold"
      SET status = 'expired'::"HoldStatus"
      WHERE id IN (SELECT id FROM expired)
      RETURNING id
    `
  );

  return { rowsAffected: expired.length, status: 'success' };
};
