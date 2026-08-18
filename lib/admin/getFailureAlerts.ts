/**
 * getFailureAlerts — recent operational failures for the admin Overview
 * "Failure alerts" section (Issue 064).
 *
 * In-process Prisma (NEVER self-fetch — AGENTS.md Issue 002/003). Surfaces:
 *   - deadNotifications    NotificationLog status=failed that has exhausted retries
 *                          (attemptCount >= MAX_ATTEMPTS) — needs a human, will never
 *                          self-heal.
 *   - retryingNotifications NotificationLog status=failed still under the retry cap
 *                          (attemptCount < MAX_ATTEMPTS) — a transient blip the cron
 *                          will re-attempt; NOT actionable yet. (#327: a retrying blip
 *                          and a permanently-dead delivery used to render identically.)
 *   - orphanPayments       ACTIONABLE orphan PaymentEvent rows: bookingId IS NULL AND
 *                          unmatchedReason != 'account_mismatch' (#370). Bank transfers
 *                          recorded but never matched to a booking (Bug B, #324) that a
 *                          human CAN still reconcile. account_mismatch (Issue 334, foreign
 *                          account) is excluded — it is never resolvable, so counting it
 *                          made this a ratchet that never returns to zero. Claiming a
 *                          match sets bookingId, so it drops out of the count.
 *   - failedPayouts        count of Payout rows in status=failed (PayoutStatus.failed).
 *   - recent               last N failed notifications (id/template/recipient/createdAt/
 *                          lastError) for an at-a-glance list. Recipient is the only
 *                          PII here and is rendered masked by the page, not stored.
 *
 * Counts + a short list only — this is a triage glance, not a full incident view;
 * the System tab (070) owns the deep failure dashboards.
 */

import { prisma as defaultPrisma } from '@/lib/core/db/client';
import { MAX_ATTEMPTS } from '@/lib/notification';

export interface FailureAlertItem {
  id: string;
  template: string;
  recipient: string;
  createdAt: Date;
  lastError: string | null;
  /** #370: exposed so the list can distinguish permanently-dead (>= MAX_ATTEMPTS)
   *  from still-retrying rows instead of rendering them identically. */
  attemptCount: number;
}

export interface FailureAlerts {
  deadNotifications: number;
  retryingNotifications: number;
  orphanPayments: number;
  failedPayouts: number;
  recent: FailureAlertItem[];
}

/** Minimal prisma surface — lets unit tests inject stubs. */
type PrismaLike = Pick<typeof defaultPrisma, 'notificationLog' | 'payout' | 'paymentEvent'>;

export async function getFailureAlerts(
  limit = 5,
  prisma: PrismaLike = defaultPrisma
): Promise<FailureAlerts> {
  const [deadNotifications, retryingNotifications, orphanPayments, failedPayouts, recent] =
    await Promise.all([
      prisma.notificationLog.count({
        where: { status: 'failed', attemptCount: { gte: MAX_ATTEMPTS } },
      }),
      prisma.notificationLog.count({
        where: { status: 'failed', attemptCount: { lt: MAX_ATTEMPTS } },
      }),
      // #370: only ACTIONABLE orphans. 'account_mismatch' (Issue 334, foreign account)
      // is unresolvable, so counting it made the "cần xử lý" tile a ratchet that never
      // returns to zero. NULL unmatchedReason = legacy orphan (pre-column) → still
      // actionable, hence the explicit OR rather than a bare `not` (which drops NULLs).
      prisma.paymentEvent.count({
        where: {
          bookingId: null,
          OR: [{ unmatchedReason: null }, { unmatchedReason: { not: 'account_mismatch' } }],
        },
      }),
      prisma.payout.count({ where: { status: 'failed' } }),
      prisma.notificationLog.findMany({
        where: { status: 'failed' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          template: true,
          recipient: true,
          createdAt: true,
          lastError: true,
          attemptCount: true,
        },
      }),
    ]);

  return { deadNotifications, retryingNotifications, orphanPayments, failedPayouts, recent };
}
