/**
 * withAdvisoryLock — run a job core inside a single transaction guarded by a
 * Postgres transaction-scoped advisory lock.
 *
 * Opens one prisma.$transaction and attempts pg_try_advisory_xact_lock(hashtext(jobName)).
 * - lock NOT acquired (another invocation holds it) → return { rowsAffected: 0,
 *   status: 'skipped_locked' } without running the core.
 * - lock acquired → run the core with the tx handle and return its JobResult.
 *
 * The xact-scoped lock auto-releases when the transaction commits or rolls back
 * (no manual pg_advisory_unlock), so it is safe under Prisma connection pooling
 * where the same connection is not guaranteed across calls.
 *
 * hashtext() returns int4; pg_try_advisory_xact_lock widens it to the bigint
 * single-key overload, giving each distinct jobName its own lock key.
 *
 * V1 note: the reminder + payout cores perform SMS (esms stub) and bank
 * settlement (stub) that do NOT yet make real network I/O, so holding the tx
 * across them is acceptable. When real eSMS/bank HTTP lands, those jobs must
 * switch to a claim-then-dispatch outbox pattern — commit the
 * reminderSentAt/'processing' claim first, then call the network outside the tx.
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import type { JobCore, JobResult } from './types';

export async function withAdvisoryLock(
  jobName: string,
  core: JobCore
): Promise<JobResult> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ locked: boolean }[]>(
      Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtext(${jobName})) AS locked`
    );

    if (!rows[0]?.locked) {
      return { rowsAffected: 0, status: 'skipped_locked' };
    }

    return core(tx);
  });
}
