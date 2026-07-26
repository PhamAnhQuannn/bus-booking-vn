import { describe, it, expect, vi } from 'vitest';
import { getFailureAlerts } from '../getFailureAlerts';
import { MAX_ATTEMPTS } from '@/lib/notification';

/**
 * #327: getFailureAlerts must split failed notifications into permanently-dead
 * (attemptCount >= MAX_ATTEMPTS — needs a human) vs still-retrying, and surface
 * the orphan PaymentEvent backlog (bookingId IS NULL) that no other alert covers.
 */

type CountArgs = { where: { attemptCount?: { gte?: number; lt?: number } } };

function makePrisma() {
  return {
    notificationLog: {
      // Return distinct counts per branch so the assertions prove the split routed
      // the gte/lt predicates to the right output fields.
      count: vi.fn(async ({ where }: CountArgs) => {
        if (where.attemptCount?.gte !== undefined) return 3; // dead
        if (where.attemptCount?.lt !== undefined) return 7; // retrying
        return 0;
      }),
      findMany: vi.fn(async () => [
        { id: 'n1', template: 'customerBookingPaid', recipient: '+8490xxxxxx1', createdAt: new Date(), lastError: 'boom' },
      ]),
    },
    payout: { count: vi.fn(async () => 2) },
    paymentEvent: { count: vi.fn(async () => 4) },
  };
}

describe('getFailureAlerts (#327)', () => {
  it('splits dead vs retrying notifications and counts orphan payments', async () => {
    const prisma = makePrisma();
    const result = await getFailureAlerts(5, prisma as never);

    expect(result).toEqual({
      deadNotifications: 3,
      retryingNotifications: 7,
      orphanPayments: 4,
      failedPayouts: 2,
      recent: [expect.objectContaining({ id: 'n1', template: 'customerBookingPaid' })],
    });
  });

  it('gates dead on attemptCount >= MAX_ATTEMPTS and retrying on < MAX_ATTEMPTS', async () => {
    const prisma = makePrisma();
    await getFailureAlerts(5, prisma as never);

    expect(prisma.notificationLog.count).toHaveBeenCalledWith({
      where: { status: 'failed', attemptCount: { gte: MAX_ATTEMPTS } },
    });
    expect(prisma.notificationLog.count).toHaveBeenCalledWith({
      where: { status: 'failed', attemptCount: { lt: MAX_ATTEMPTS } },
    });
  });

  it('counts an orphan PaymentEvent as one with bookingId IS NULL', async () => {
    const prisma = makePrisma();
    await getFailureAlerts(5, prisma as never);

    expect(prisma.paymentEvent.count).toHaveBeenCalledWith({ where: { bookingId: null } });
  });

  it('passes the limit through to the recent-failures query', async () => {
    const prisma = makePrisma();
    await getFailureAlerts(9, prisma as never);

    expect(prisma.notificationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'failed' }, take: 9 })
    );
  });
});
