/**
 * touchLastViewed — update OperatorUser.lastBookingsViewedAt to now (Issue 014 AC7).
 *
 * Called when operator loads the booking queue page. Badge count resets relative
 * to this timestamp on next load.
 */

import { prisma } from '@/lib/db/client';

export async function touchLastViewed(operatorUserId: string): Promise<void> {
  await prisma.operatorUser.update({
    where: { id: operatorUserId },
    data: { lastBookingsViewedAt: new Date() },
  });
}
