/**
 * Unit tests for salesToggle lib function (Issue 013 AC7).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/core/db/client', () => {
  const txMock = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    trip: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    prisma: {
      $transaction: vi.fn((fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
      _txMock: txMock,
    },
  };
});

import { salesToggle } from '../salesToggle';
import { TripServiceError } from '../errors';
import { prisma } from '@/lib/core/db/client';

const p = prisma as unknown as {
  $transaction: Mock;
  _txMock: {
    $queryRaw: Mock;
    trip: { findFirst: Mock; update: Mock };
  };
};

const TRIP_ROW = {
  id: 'trip-1',
  routeId: 'r-1',
  busId: 'b-1',
  operatorId: 'op-1',
  departureAt: new Date('2026-06-01T08:00:00Z'),
  price: 100000,
  status: 'scheduled',
  salesClosed: true,
  blockedSeats: 0,
  recurringTemplateId: null,
  pairedTripId: null,
  cancelReason: null,
  cancelledAt: null,
  bus: { capacity: 30 },
  _count: { holds: 0, bookings: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('salesToggle', () => {
  it('flips salesClosed to true', async () => {
    p._txMock.trip.findFirst.mockResolvedValue({ id: 'trip-1' });
    p._txMock.trip.update.mockResolvedValue({ ...TRIP_ROW, salesClosed: true });

    const dto = await salesToggle('op-1', 'trip-1', true);
    expect(dto.salesClosed).toBe(true);
  });

  it('flips salesClosed to false', async () => {
    p._txMock.trip.findFirst.mockResolvedValue({ id: 'trip-1' });
    p._txMock.trip.update.mockResolvedValue({ ...TRIP_ROW, salesClosed: false });

    const dto = await salesToggle('op-1', 'trip-1', false);
    expect(dto.salesClosed).toBe(false);
  });

  it('throws not_found for cross-op trip', async () => {
    p._txMock.trip.findFirst.mockResolvedValue(null);

    await expect(salesToggle('op-1', 'trip-other', true)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('does NOT touch bookings or holds (AC7)', async () => {
    p._txMock.trip.findFirst.mockResolvedValue({ id: 'trip-1' });
    p._txMock.trip.update.mockResolvedValue({ ...TRIP_ROW, salesClosed: true });

    await salesToggle('op-1', 'trip-1', true);

    // Ensure only trip.update was called — no booking/hold mutations
    expect(p._txMock.trip.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { salesClosed: true },
      })
    );
  });
});
