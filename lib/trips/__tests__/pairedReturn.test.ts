/**
 * Unit tests for pairedReturn lib function (Issue 013 AC6).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/db/client', () => {
  const txMock = {
    $queryRaw: vi.fn(),
    route: { findUnique: vi.fn(), findFirst: vi.fn() },
    bus: { findFirst: vi.fn() },
    trip: { create: vi.fn(), update: vi.fn() },
  };

  return {
    prisma: {
      $transaction: vi.fn((fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
      _txMock: txMock,
    },
  };
});

import { pairedReturn } from '../pairedReturn';
import { TripServiceError } from '../errors';
import { prisma } from '@/lib/db/client';

const p = prisma as unknown as {
  $transaction: Mock;
  _txMock: {
    $queryRaw: Mock;
    route: { findUnique: Mock; findFirst: Mock };
    bus: { findFirst: Mock };
    trip: { create: Mock; update: Mock };
  };
};

const SOURCE_LOCKED = [
  {
    id: 'trip-out',
    routeId: 'route-hn-hcm',
    busId: 'bus-1',
    departureAt: new Date('2026-06-01T08:00:00Z'),
    price: 100000,
    pairedTripId: null,
  },
];

const SOURCE_ROUTE = { origin: 'Hanoi', destination: 'Ho Chi Minh', durationMinutes: 480 };
const REVERSE_ROUTE = { id: 'route-hcm-hn' };

const BUS = {
  id: 'bus-1',
  capacity: 30,
  deactivatedAt: null,
  maintenanceStart: null,
  maintenanceEnd: null,
};

const RETURN_TRIP = {
  id: 'trip-ret',
  routeId: 'route-hcm-hn',
  busId: 'bus-1',
  operatorId: 'op-1',
  departureAt: new Date('2026-06-01T20:00:00Z'),
  price: 100000,
  status: 'scheduled',
  salesClosed: false,
  blockedSeats: 0,
  recurringTemplateId: null,
  pairedTripId: 'trip-out',
  cancelReason: null,
  cancelledAt: null,
  bus: { capacity: 30 },
  _count: { holds: 0, bookings: 0 },
};

const UPDATED_OUTBOUND = {
  ...RETURN_TRIP,
  id: 'trip-out',
  routeId: 'route-hn-hcm',
  pairedTripId: 'trip-ret',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pairedReturn', () => {
  it('creates paired return trip successfully', async () => {
    // $queryRaw called twice: 1) SELECT FOR UPDATE, 2) bus overlap check
    p._txMock.$queryRaw.mockResolvedValueOnce(SOURCE_LOCKED).mockResolvedValueOnce([]); // no overlap
    p._txMock.route.findUnique.mockResolvedValue(SOURCE_ROUTE);
    p._txMock.route.findFirst.mockResolvedValue(REVERSE_ROUTE);
    p._txMock.bus.findFirst.mockResolvedValue(BUS);
    p._txMock.trip.create.mockResolvedValue(RETURN_TRIP);
    p._txMock.trip.update.mockResolvedValue(UPDATED_OUTBOUND);

    const returnDepartureAt = new Date('2026-06-01T20:00:00Z'); // > source + 1h
    const result = await pairedReturn('op-1', 'trip-out', returnDepartureAt);

    expect(result.returnTrip.pairedTripId).toBe('trip-out');
    expect(result.outboundTrip.pairedTripId).toBe('trip-ret');
  });

  it('throws not_found for cross-op trip', async () => {
    // $queryRaw called once: SELECT FOR UPDATE returns empty
    p._txMock.$queryRaw.mockResolvedValue([]);

    await expect(
      pairedReturn('op-1', 'trip-missing', new Date('2026-06-01T20:00:00Z'))
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('throws no_reverse_route when reverse route does not exist (AC6)', async () => {
    // $queryRaw called once: SELECT FOR UPDATE (fails at reverse route check before overlap)
    p._txMock.$queryRaw.mockResolvedValue(SOURCE_LOCKED);
    p._txMock.route.findUnique.mockResolvedValue(SOURCE_ROUTE);
    p._txMock.route.findFirst.mockResolvedValue(null); // no reverse route

    await expect(
      pairedReturn('op-1', 'trip-out', new Date('2026-06-01T20:00:00Z'))
    ).rejects.toMatchObject({ code: 'no_reverse_route' });
  });

  it('throws error when returnDepartureAt is NOT > sourceDepartureAt + 1h', async () => {
    // $queryRaw called once: SELECT FOR UPDATE (fails at time validation before overlap)
    p._txMock.$queryRaw.mockResolvedValue(SOURCE_LOCKED);
    // source departureAt = 08:00, + 1h = 09:00; return = 08:30 (not valid)
    const tooEarlyReturn = new Date('2026-06-01T08:30:00Z');

    await expect(
      pairedReturn('op-1', 'trip-out', tooEarlyReturn)
    ).rejects.toThrow(/returnDepartureAt must be > sourceDepartureAt \+ 1h/);
  });

  it('throws bus_in_maintenance when return bus has maintenance at return time', async () => {
    // $queryRaw called once: SELECT FOR UPDATE (fails at maintenance check before overlap)
    p._txMock.$queryRaw.mockResolvedValue(SOURCE_LOCKED);
    p._txMock.route.findUnique.mockResolvedValue(SOURCE_ROUTE);
    p._txMock.route.findFirst.mockResolvedValue(REVERSE_ROUTE);
    p._txMock.bus.findFirst.mockResolvedValue({
      ...BUS,
      maintenanceStart: new Date('2026-06-01T18:00:00Z'),
      maintenanceEnd: new Date('2026-06-01T22:00:00Z'),
    });

    // Return at 20:00 falls within maintenance 18:00-22:00
    await expect(
      pairedReturn('op-1', 'trip-out', new Date('2026-06-01T20:00:00Z'))
    ).rejects.toMatchObject({ code: 'bus_in_maintenance' });
  });

  it('throws bus_overlap_with_outbound when bus is already assigned to an overlapping trip (AC6)', async () => {
    // $queryRaw called twice: 1) SELECT FOR UPDATE returns source, 2) overlap check returns a conflicting trip
    p._txMock.$queryRaw
      .mockResolvedValueOnce(SOURCE_LOCKED)   // lock query
      .mockResolvedValueOnce([{ id: 'trip-conflict' }]); // overlap query — bus is busy
    p._txMock.route.findUnique.mockResolvedValue(SOURCE_ROUTE);
    p._txMock.route.findFirst.mockResolvedValue(REVERSE_ROUTE);
    p._txMock.bus.findFirst.mockResolvedValue(BUS);

    const returnDepartureAt = new Date('2026-06-01T20:00:00Z');

    await expect(
      pairedReturn('op-1', 'trip-out', returnDepartureAt)
    ).rejects.toMatchObject({ code: 'bus_overlap_with_outbound' });

    // Trip should NOT have been created
    expect(p._txMock.trip.create).not.toHaveBeenCalled();
  });
});
