/**
 * Unit tests for createCashBooking (WT-13).
 *
 * Mocks prisma.$transaction to test service logic without a live DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/payment/applyPaidTransition', () => ({
  appendBookingPaidLedger: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/booking/bookingRef', () => ({
  generateBookingRef: vi.fn().mockReturnValue('BB-2026-abcd-efgh'),
}));

vi.mock('@/lib/booking/confirmationToken', () => ({
  generateConfirmationToken: vi.fn().mockReturnValue('test-token-32chars-padded0000000'),
}));

vi.mock('uuidv7', () => ({
  uuidv7: vi.fn().mockReturnValue('00000000-0000-7000-8000-000000000001'),
}));

import { createCashBooking } from '../createCashBooking';
import { prisma } from '@/lib/core/db/client';
import { appendBookingPaidLedger } from '@/lib/payment/applyPaidTransition';

const mockTransaction = vi.mocked(prisma.$transaction);

function makeTx() {
  return {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };
}

const baseInput = {
  tripId: 'trip-1',
  operatorId: 'op-1',
  buyerName: 'Nguyen Van A',
  buyerPhone: '+8490xxxxxx1',
  ticketCount: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createCashBooking', () => {
  it('creates a cash booking with paid status and ledger entries', async () => {
    const tx = makeTx();

    tx.$queryRaw
      .mockResolvedValueOnce([{
        id: 'trip-1',
        price: 150000,
        status: 'scheduled',
        salesClosed: false,
        departureAt: new Date(Date.now() + 86400000),
        busCapacity: 30,
        tripOperatorId: 'op-1',
      }])
      .mockResolvedValueOnce([{ taken: 5 }]);

    tx.$executeRaw.mockResolvedValueOnce(1);

    mockTransaction.mockImplementation(async (cb: unknown) => {
      return (cb as (t: typeof tx) => Promise<unknown>)(tx);
    });

    const result = await createCashBooking(baseInput);

    expect(result.bookingRef).toBe('BB-2026-abcd-efgh');
    expect(result.tripId).toBe('trip-1');
    expect(result.buyerName).toBe('Nguyen Van A');
    expect(result.ticketCount).toBe(2);
    expect(result.totalVnd).toBe(300000);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(appendBookingPaidLedger).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        operatorId: 'op-1',
        grossVnd: 300000,
      }),
    );
  });

  it('throws trip_not_found when trip does not exist', async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([]);

    mockTransaction.mockImplementation(async (cb: unknown) => {
      return (cb as (t: typeof tx) => Promise<unknown>)(tx);
    });

    await expect(createCashBooking(baseInput)).rejects.toThrow('trip_not_found');
  });

  it('throws trip_not_found when trip belongs to different operator', async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValueOnce([{
      id: 'trip-1',
      price: 150000,
      status: 'scheduled',
      salesClosed: false,
      departureAt: new Date(Date.now() + 86400000),
      busCapacity: 30,
      tripOperatorId: 'op-other',
    }]);

    mockTransaction.mockImplementation(async (cb: unknown) => {
      return (cb as (t: typeof tx) => Promise<unknown>)(tx);
    });

    await expect(createCashBooking(baseInput)).rejects.toThrow('trip_not_found');
  });

  it('throws trip_not_bookable when trip is cancelled', async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValueOnce([{
      id: 'trip-1',
      price: 150000,
      status: 'cancelled',
      salesClosed: false,
      departureAt: new Date(Date.now() + 86400000),
      busCapacity: 30,
      tripOperatorId: 'op-1',
    }]);

    mockTransaction.mockImplementation(async (cb: unknown) => {
      return (cb as (t: typeof tx) => Promise<unknown>)(tx);
    });

    await expect(createCashBooking(baseInput)).rejects.toThrow('trip_not_bookable');
  });

  it('throws insufficient_capacity when seats are full', async () => {
    const tx = makeTx();
    tx.$queryRaw
      .mockResolvedValueOnce([{
        id: 'trip-1',
        price: 150000,
        status: 'scheduled',
        salesClosed: false,
        departureAt: new Date(Date.now() + 86400000),
        busCapacity: 10,
        tripOperatorId: 'op-1',
      }])
      .mockResolvedValueOnce([{ taken: 9 }]);

    mockTransaction.mockImplementation(async (cb: unknown) => {
      return (cb as (t: typeof tx) => Promise<unknown>)(tx);
    });

    await expect(createCashBooking(baseInput)).rejects.toThrow('insufficient_capacity');
  });
});
