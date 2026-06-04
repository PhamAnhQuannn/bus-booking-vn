/**
 * charterExpirySweeper — JobCore that reroutes timed-out charter leads back to
 * admin review (Issue 086).
 *
 * Two classes of stale lead are claimed and rerouted each run:
 *
 *   1. ASSIGNED_DIRECT with acceptByAt <= now — the directly-assigned operator
 *      (Issue 083) never accepted/declined before its deadline. Single-step
 *      transition ASSIGNED_DIRECT → ADMIN_REVIEW (Issue 086 timeout edge), which
 *      clears assigneeOperatorId + the stale acceptByAt (frees the operator).
 *
 *   2. PUBLISHED with claimByAt <= now — the public pool (Issue 084) expired with
 *      no operator claiming it. Two-step PUBLISHED → EXPIRED → ADMIN_REVIEW
 *      (EXPIRED is a transient routing state; the existing 081 EXPIRED → ADMIN_REVIEW
 *      edge re-routes it). EXPIRED clears the assignee; ADMIN_REVIEW clears the
 *      stale claimByAt.
 *
 * Each rerouted lead also enqueues a best-effort `charterReturnedToReview`
 * sms + email to the customer contact ("still searching, no action needed").
 *
 * Concurrency (Mistake Log 043 run-lock + 084 claim race):
 *   - The whole tick runs under the 'charter-sweep' advisory lock (runJob /
 *     withAdvisoryLock), so two overlapping cron ticks cannot both sweep.
 *   - Within a tick, each candidate is claimed with SELECT … FOR UPDATE SKIP
 *     LOCKED so a row already locked by a concurrent operator action (an accept /
 *     decline / claim transition, which itself takes SELECT … FOR UPDATE on the
 *     row) is skipped, not blocked. After claiming, transitionCharterRequest opens
 *     its OWN short $transaction with FOR UPDATE on the same row and re-checks the
 *     status; if a concurrent action already moved the row (e.g. the operator
 *     accepted just in time, or a 084 claim won), the edge is now illegal and
 *     transitionCharterRequest throws CharterError('illegal_transition') — we
 *     catch that per-row and skip, continuing with the rest. This makes the
 *     sweeper safe to run alongside live operator actions: whichever commits first
 *     wins, the loser no-ops.
 *
 * The lock `tx` is NOT threaded into the per-row transitions — each transition
 * commits independently (mirrors generateTrips / dispatchNotifications). The lock
 * tx exists only to hold the 'charter-sweep' advisory key. The claim SELECT runs
 * on the lock tx (it reads candidate ids under the tick's connection); the
 * transitions run on the pooled `prisma` client in their own short transactions.
 *
 * rowsAffected = total leads rerouted to ADMIN_REVIEW this run.
 */

import type { JobCore } from './types';

/** Bound the work per tick so a backlog can't hold the lock indefinitely. */
const CLAIM_LIMIT = 200;

interface StaleRow {
  id: string;
  ref: string;
  contactPhone: string;
  contactEmail: string;
}

export const charterExpirySweeper: JobCore = async (tx, opts) => {
  // Lazy import: lib/db/client + the transition service transitively construct
  // the Prisma client at module-eval (throws when DATABASE_URL is unset). The
  // cron route's unit tests mock runJob and never invoke this core, so the
  // dynamic import keeps the route's static import graph free of the DB client —
  // exactly how generateTrips / dispatchNotifications avoid the import-time break.
  const { prisma } = await import('@/lib/core/db/client');
  const { transitionCharterRequest } = await import('@/lib/charter');
  const { CharterError } = await import('@/lib/charter');
  const { createNotificationLog } = await import('@/lib/core/db/notificationLogRepo');
  const { Prisma } = await import('@prisma/client');

  const now = opts?.now ?? new Date();
  const actor = 'cron:charter-sweep';

  // Claim stale candidates under the tick's lock connection. SKIP LOCKED so a row
  // currently locked by a concurrent operator action is left for that action
  // rather than blocking the sweep.
  const assignedStale = await tx.$queryRaw<StaleRow[]>(Prisma.sql`
    SELECT "id", "ref", "contactPhone", "contactEmail"
    FROM "CharterRequest"
    WHERE "status" = 'ASSIGNED_DIRECT'
      AND "acceptByAt" IS NOT NULL
      AND "acceptByAt" <= ${now}
    FOR UPDATE SKIP LOCKED
    LIMIT ${CLAIM_LIMIT}
  `);

  const publishedStale = await tx.$queryRaw<StaleRow[]>(Prisma.sql`
    SELECT "id", "ref", "contactPhone", "contactEmail"
    FROM "CharterRequest"
    WHERE "status" = 'PUBLISHED'
      AND "claimByAt" IS NOT NULL
      AND "claimByAt" <= ${now}
    FOR UPDATE SKIP LOCKED
    LIMIT ${CLAIM_LIMIT}
  `);

  let rerouted = 0;

  // Best-effort customer "still searching" notification — a NotificationLog
  // failure must never abort the sweep or roll back the (already-committed)
  // transition.
  async function notifyReturned(row: StaleRow): Promise<void> {
    const payload = JSON.stringify({ ref: row.ref });
    await createNotificationLog({
      channel: 'sms',
      template: 'charterReturnedToReview',
      recipient: row.contactPhone,
      payload,
      status: 'pending',
    });
    await createNotificationLog({
      channel: 'email',
      template: 'charterReturnedToReview',
      recipient: row.contactEmail,
      payload,
      status: 'pending',
    });
  }

  // 1. Direct-assign timeouts: single-step ASSIGNED_DIRECT → ADMIN_REVIEW.
  for (const row of assignedStale) {
    try {
      await transitionCharterRequest(prisma, {
        charterId: row.id,
        to: 'ADMIN_REVIEW',
        actor,
      });
    } catch (err) {
      // A concurrent operator accept/decline moved the row first → the edge is
      // now illegal. Skip this row, leave the rest of the sweep running.
      if (err instanceof CharterError && err.code === 'illegal_transition') {
        continue;
      }
      throw err;
    }
    rerouted += 1;
    await notifyReturned(row);
  }

  // 2. Public-pool expiry: two-step PUBLISHED → EXPIRED → ADMIN_REVIEW.
  for (const row of publishedStale) {
    try {
      await transitionCharterRequest(prisma, {
        charterId: row.id,
        to: 'EXPIRED',
        actor,
      });
    } catch (err) {
      // A concurrent claim (Issue 084) won the pool item first → PUBLISHED →
      // EXPIRED is now illegal. Skip; the row is already ACCEPTED.
      if (err instanceof CharterError && err.code === 'illegal_transition') {
        continue;
      }
      throw err;
    }
    // EXPIRED is transient — immediately re-route to ADMIN_REVIEW. EXPIRED →
    // ADMIN_REVIEW is only reachable by us here, so an illegal_transition would
    // be a genuine bug; let it surface (do not swallow).
    await transitionCharterRequest(prisma, {
      charterId: row.id,
      to: 'ADMIN_REVIEW',
      actor,
    });
    rerouted += 1;
    await notifyReturned(row);
  }

  return { rowsAffected: rerouted, status: 'success' };
};
