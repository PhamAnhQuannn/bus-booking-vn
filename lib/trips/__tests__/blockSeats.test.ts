/**
 * Unit tests for blockSeats lib function (Issue 013 AC2).
 * Tests boundary conditions + error paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/db/client', () => {
  const txMock = {
    $queryRaw: vi.fn(),
    trip: { findUnique: vi.fn(), update: vi.fn() },
    hold: {},
    booking: {},
  };

  return {
    prisma: {
      $transaction: vi.fn((fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
      _txMock: txMock,
    },
  };
});

import { blockSeats } from '../blockSeats';
import { TripServiceError } from '../errors';
import { prisma } from '@/lib/db/client';

const p = prisma as unknown as { $transaction: Mock; _txMock: {
  $queryRaw: Mock;
  trip: { findUnique: Mock; update: Mock };
} };

beforeEach(() => {
  vi.clearAllMocks();
});

function setupTransaction(
  lockedRows: { id: string }[],
  trip: {
    id: string;
    status: string;
    bus: { capacity: number };
    holds: { ticketCount: number }[];
    bookings: { ticketCount: number }[];
  } | null,
  updatedTrip?: object
) {
  p._txMock.$queryRaw.mockResolvedValue(lockedRows);
  p._txMock.trip.findUnique.mockResolvedValue(trip);
  if (updatedTrip) {
    p._txMock.trip.update.mockResolvedValue(updatedTrip);
  }
}

const LOCKED = [{ id: 'trip-1' }];
const BASE_TRIP = {
  id: 'trip-1',
  status: 'scheduled',
  bus: { capacity: 30 },
  holds: [],
  bookings: [],
};
const UPDATED_TRIP = {
  id: 'trip-1',
  routeId: 'r-1',
  busId: 'b-1',
  operatorId: 'op-1',
  departureAt: new Date('2026-06-01T08:00:00Z'),
  price: 100000,
  status: 'scheduled',
  salesClosed: false,
  blockedSeats: 5,
  recurringTemplateId: null,
  pairedTripId: null,
  cancelReason: null,
  cancelledAt: null,
  bus: { capacity: 30 },
  _count: { holds: 0, bookings: 0 },
};

describe('blockSeats', () => {
  it('succeeds when blockedSeats <= capacity - holds - bookings', async () => {
    setupTransaction(LOCKED, BASE_TRIP, UPDATED_TRIP);

    const dto = await blockSeats('op-1', 'trip-1', 5);
    expect(dto.blockedSeats).toBe(5);
  });

  it('succeeds at the exact boundary (blockedSeats = maxAllowedBlocked)', async () => {
    const tripWith2HoldsAnd3Bookings = {
      ...BASE_TRIP,
      holds: [{ ticketCount: 2 }],
      bookings: [{ ticketCount: 3 }],
    };
    setupTransaction(LOCKED, tripWith2HoldsAnd3Bookings, { ...UPDATED_TRIP, blockedSeats: 25 });

    // capacity=30, holds=2, bookings=3 → maxAllowed = 25
    const dto = await blockSeats('op-1', 'trip-1', 25);
    expect(dto.blockedSeats).toBe(25);
  });

  it('throws block_exceeds_available when blockedSeats > capacity - holds - bookings', async () => {
    const tripWith5Holds = {
      ...BASE_TRIP,
      holds: [{ ticketCount: 5 }],
    };
    setupTransaction(LOCKED, tripWith5Holds);

    // capacity=30, holds=5, bookings=0 → maxAllowed=25; request=26
    await expect(blockSeats('op-1', 'trip-1', 26)).rejects.toMatchObject({
      code: 'block_exceeds_available',
    });
  });

  it('throws not_found when trip does not belong to operator', async () => {
    p._txMock.$queryRaw.mockResolvedValue([]); // locked rows empty = cross-op or missing

    await expect(blockSeats('op-1', 'trip-missing', 5)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('throws block_exceeds_available when request exactly exceeds (capacity=10, holds=5, bookings=5, request=1)', async () => {
    const fullTrip = {
      ...BASE_TRIP,
      bus: { capacity: 10 },
      holds: [{ ticketCount: 5 }],
      bookings: [{ ticketCount: 5 }],
    };
    setupTransaction(LOCKED, fullTrip);

    // maxAllowed = 10 - 5 - 5 = 0; requesting 1 → exceeds
    await expect(blockSeats('op-1', 'trip-1', 1)).rejects.toMatchObject({
      code: 'block_exceeds_available',
    });
  });

  it('allows blocking 0 seats', async () => {
    setupTransaction(LOCKED, BASE_TRIP, { ...UPDATED_TRIP, blockedSeats: 0 });

    const dto = await blockSeats('op-1', 'trip-1', 0);
    expect(dto.blockedSeats).toBe(0);
  });
});
