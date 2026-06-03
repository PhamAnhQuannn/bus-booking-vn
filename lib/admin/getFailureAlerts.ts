/**
 * getFailureAlerts — recent operational failures for the admin Overview
 * "Failure alerts" section (Issue 064).
 *
 * In-process Prisma (NEVER self-fetch — AGENTS.md Issue 002/003). Surfaces:
 *   - failedNotifications  count of NotificationLog rows in status=failed (SMS/email
 *                          that never delivered — NotificationStatus.failed, lowercase).
 *   - failedPayouts        count of Payout rows in status=failed (PayoutStatus.failed).
 *   - recent               last N failed notifications (id/template/recipient/createdAt/
 *                          lastError) for an at-a-glance list. Recipient is the only
 *                          PII here and is rendered masked by the page, not stored.
 *
 * Counts + a short list only — this is a triage glance, not a full incident view;
 * the System tab (070) owns the deep failure dashboards.
 */

import { prisma as defaultPrisma } from '@/lib/core/db/client';

export interface FailureAlertItem {
  id: string;
  template: string;
  recipient: string;
  createdAt: Date;
  lastError: string | null;
}

export interface FailureAlerts {
  failedNotifications: number;
  failedPayouts: number;
  recent: FailureAlertItem[];
}

/** Minimal prisma surface — lets unit tests inject stubs. */
type PrismaLike = Pick<typeof defaultPrisma, 'notificationLog' | 'payout'>;

export async function getFailureAlerts(
  limit = 5,
  prisma: PrismaLike = defaultPrisma
): Promise<FailureAlerts> {
  const [failedNotifications, failedPayouts, recent] = await Promise.all([
    prisma.notificationLog.count({ where: { status: 'failed' } }),
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
      },
    }),
  ]);

  return { failedNotifications, failedPayouts, recent };
}
