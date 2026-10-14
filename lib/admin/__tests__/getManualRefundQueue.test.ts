import { describe, it, expect, vi } from 'vitest';
import { getManualRefundQueue } from '../getManualRefundQueue';

/** #833 / #851: owed-money lists for the admin Finance tab. */

function makePrisma() {
  const createdAt = new Date('2026-10-01T00:00:00.000Z');
  return {
    refundObligation: {
      findMany: vi.fn(async () => [
        { id: 'ob-1', bookingId: 'bk-1', amountMinor: 150000, reason: 'operator_cancel', createdAt },
      ]),
    },
    paymentEvent: {
      findMany: vi.fn(async () => [
        {
          id: 'pe-1',
          providerTxnId: 'sepay-9',
          unmatchedReason: 'underpaid',
          receivedAt: createdAt,
          booking: { bookingRef: 'BB-2' },
        },
      ]),
    },
    booking: { findMany: vi.fn(async () => [{ id: 'bk-1', bookingRef: 'BB-1' }]) },
  };
}

describe('getManualRefundQueue', () => {
  it('lists manual_pending obligations and unresolved linked unfulfilled events', async () => {
    const prisma = makePrisma();
    const q = await getManualRefundQueue(prisma as never);

    expect(prisma.refundObligation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'manual_pending' } })
    );
    expect(prisma.paymentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          bookingId: { not: null },
          unmatchedReason: { in: ['late_booking_terminal', 'duplicate_booking_paid', 'underpaid'] },
          resolvedAt: null,
        },
      })
    );
    expect(q.refunds).toEqual([
      expect.objectContaining({ id: 'ob-1', bookingRef: 'BB-1', amountMinor: 150000 }),
    ]);
    expect(q.payments).toEqual([
      expect.objectContaining({ id: 'pe-1', bookingRef: 'BB-2', providerTxnId: 'sepay-9' }),
    ]);
  });

  it('skips the booking lookup when nothing is owed', async () => {
    const prisma = makePrisma();
    prisma.refundObligation.findMany.mockResolvedValueOnce([]);
    const q = await getManualRefundQueue(prisma as never);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(q.refunds).toEqual([]);
  });
});
