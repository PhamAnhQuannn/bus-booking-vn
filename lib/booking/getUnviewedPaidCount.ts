/**
 * getUnviewedPaidCount — count paid bookings newer than operator's last viewed timestamp (Issue 014 AC1 badge).
 *
 * Returns 0 if lastBookingsViewedAt is null (first visit — will be set by touchLastViewed).
 */

import { prisma } from '@/lib/db/client';

const PAID_STATUSES = [
  'paid',
  'pending_cash_payment',
  'completed',
] as const;

export async function getUnviewedPaidCount(
  operatorUserId: string,
  operatorId: string
): Promise<number> {
  const opUser = await prisma.operatorUser.findUnique({
    where: { id: operatorUserId },
    select: { lastBookingsViewedAt: true },
  });

  if (!opUser) return 0;

  const since = opUser.lastBookingsViewedAt;

  if (!since) {
    // Never viewed — count all paid bookings for this operator
    return prisma.booking.count({
      where: {
        status: { in: [...PAID_STATUSES] },
        trip: { operatorId },
      },
    });
  }

  return prisma.booking.count({
    where: {
      status: { in: [...PAID_STATUSES] },
      createdAt: { gt: since },
      trip: { operatorId },
    },
  });
}
