import { describe, it, expect, vi } from 'vitest';
import { getOrphanPaymentQueue } from '../getOrphanPaymentQueue';

/** #331: orphan transfers + the awaiting_payment bookings held on each (suspicion only). */

const RECEIVED = new Date('2026-10-16T02:00:00.000Z');
const FARE = 175_000;

function sepay(amount: number): string {
  return JSON.stringify({ transferType: 'in', transferAmount: amount, accountNumber: 'x' });
}

function makePrisma() {
  return {
    paymentEvent: {
      findMany: vi.fn(async () => [
        {
          id: 'pe-1',
          adapter: 'bank_transfer',
          providerTxnId: 'sepay-1',
          currency: 'VND',
          rawBody: sepay(FARE),
          unmatchedReason: 'no_booking_ref_in_memo',
          receivedAt: RECEIVED,
        },
        {
          id: 'pe-2',
          adapter: 'bank_transfer',
          providerTxnId: 'sepay-2',
          currency: 'VND',
          rawBody: 'not-json',
          unmatchedReason: null,
          receivedAt: RECEIVED,
        },
      ]),
    },
    booking: {
      findMany: vi.fn(async () => [
        // in window (hold anchor 10 min before), same rail, exact fare → suspected
        {
          bookingRef: 'BB-A',
          totalVnd: FARE,
          paymentMethod: 'bank_transfer',
          createdAt: new Date(RECEIVED.getTime() - 5 * 60_000),
          hold: { createdAt: new Date(RECEIVED.getTime() - 10 * 60_000) },
        },
        // second same-fare booking in window → grouped under the SAME transfer
        {
          bookingRef: 'BB-B',
          totalVnd: FARE,
          paymentMethod: 'bank_transfer',
          createdAt: new Date(RECEIVED.getTime() + 20 * 60_000),
          hold: null,
        },
        // outside the ±30 min window
        {
          bookingRef: 'BB-OLD',
          totalVnd: FARE,
          paymentMethod: 'bank_transfer',
          createdAt: new Date(RECEIVED.getTime() - 3 * 3_600_000),
          hold: null,
        },
        // wrong rail
        {
          bookingRef: 'BB-VNPAY',
          totalVnd: FARE,
          paymentMethod: 'vnpay',
          createdAt: RECEIVED,
          hold: null,
        },
      ]),
    },
  };
}

describe('getOrphanPaymentQueue', () => {
  it('lists unresolved orphans and groups suspected held bookings per transfer', async () => {
    const prisma = makePrisma();
    const rows = await getOrphanPaymentQueue(prisma as never);

    expect(prisma.paymentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bookingId: null, resolvedAt: null } })
    );
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'awaiting_payment', totalVnd: { in: [FARE] } } })
    );
    expect(rows[0]).toMatchObject({ id: 'pe-1', providerTxnId: 'sepay-1', amountVnd: FARE });
    expect(rows[0].suspectedBookings.map((b) => b.bookingRef)).toEqual(['BB-A', 'BB-B']);
    // Unparseable body → no amount, no suspects.
    expect(rows[1]).toMatchObject({ id: 'pe-2', amountVnd: null, suspectedBookings: [] });
  });

  it('never returns rawBody (payer PII, #332)', async () => {
    const rows = await getOrphanPaymentQueue(makePrisma() as never);
    for (const r of rows) expect(r).not.toHaveProperty('rawBody');
  });

  it('skips the booking lookup when no orphan has a recoverable amount', async () => {
    const prisma = makePrisma();
    prisma.paymentEvent.findMany.mockResolvedValueOnce([]);
    expect(await getOrphanPaymentQueue(prisma as never)).toEqual([]);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });
});
