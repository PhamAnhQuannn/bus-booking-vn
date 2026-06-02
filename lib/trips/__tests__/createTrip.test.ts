/**
 * Unit tests for createTrip lib function (Issue 013 AC1 + 2026-06-01 overlap guard).
 * All Prisma calls are mocked — no live DB needed.
 *
 * createTrip now: route.findFirst (duration) → $transaction { FOR UPDATE bus lock
 * (tx.$queryRaw) → busHasOverlappingTrip (tx.$queryRaw) → tx.trip.create }.
 * The two tx.$queryRaw calls are sequenced: [busLockRows, overlapRows].
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    route: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { createTrip } from '../createTrip';
import { TripServiceError } from '../errors';
import { prisma } from '@/lib/db/client';

const mockRouteFindFirst = prisma.route.findFirst as Mock;
const mockTransaction = prisma.$transaction as Mock;

const BASE_BUS_LOCK = {
  id: 'bus-1',
  deactivatedAt: null,
  maintenanceStart: null,
  maintenanceEnd: null,
};

const BASE_TRIP_ROW = {
  id: 'trip-1',
  routeId: 'route-1',
  busId: 'bus-1',
  operatorId: 'op-1',
  departureAt: new Date('2026-06-01T08:00:00Z'),
  price: 100000,
  status: 'scheduled',
  salesClosed: false,
  blockedSeats: 0,
  recurringTemplateId: null,
  pairedTripId: null,
  cancelReason: null,
  cancelledAt: null,
  bus: { capacity: 30 },
  _count: { holds: 0, bookings: 0 },
};

/**
 * Wire prisma.$transaction to run the callback against a fake tx whose
 * $queryRaw returns busLockRows then overlapRows in sequence.
 */
function wireTx(opts: {
  busLockRows: unknown[];
  overlapRows?: unknown[];
  createRow?: unknown;
}) {
  const tripCreate = vi.fn().mockResolvedValue(opts.createRow ?? BASE_TRIP_ROW);
  const queryRaw = vi
    .fn()
    .mockResolvedValueOnce(opts.busLockRows)
    .mockResolvedValueOnce(opts.overlapRows ?? []);
  mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: queryRaw, trip: { create: tripCreate } })
  );
  return { tripCreate, queryRaw };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTrip', () => {
  it('creates a trip successfully', async () => {
    mockRouteFindFirst.mockResolvedValue({ durationMinutes: 240 });
    wireTx({ busLockRows: [BASE_BUS_LOCK], overlapRows: [], createRow: BASE_TRIP_ROW });

    const dto = await createTrip({
      operatorId: 'op-1',
      routeId: 'route-1',
      busId: 'bus-1',
      departureAt: new Date('2026-06-01T08:00:00Z'),
      price: 100000,
    });

    expect(dto.status).toBe('scheduled');
    expect(dto.availableSeats).toBe(30);
  });

  it('throws not_found when the route does not belong to the operator', async () => {
    mockRouteFindFirst.mockResolvedValue(null);

    await expect(
      createTrip({
        operatorId: 'op-1',
        routeId: 'other-route',
        busId: 'bus-1',
        departureAt: new Date('2026-06-01T08:00:00Z'),
        price: 100000,
      })
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('throws not_found when bus does not belong to operator', async () => {
    mockRouteFindFirst.mockResolvedValue({ durationMinutes: 240 });
    wireTx({ busLockRows: [] }); // FOR UPDATE bus lock returns no row

    await expect(
      createTrip({
        operatorId: 'op-1',
        routeId: 'route-1',
        busId: 'other-bus',
        departureAt: new Date('2026-06-01T08:00:00Z'),
        price: 100000,
      })
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('throws bus_deactivated when bus is deactivated', async () => {
    mockRouteFindFirst.mockResolvedValue({ durationMinutes: 240 });
    wireTx({ busLockRows: [{ ...BASE_BUS_LOCK, deactivatedAt: new Date('2026-05-01') }] });

    await expect(
      createTrip({
        operatorId: 'op-1',
        routeId: 'route-1',
        busId: 'bus-1',
        departureAt: new Date('2026-06-01T08:00:00Z'),
        price: 100000,
      })
    ).rejects.toMatchObject({ code: 'bus_deactivated' });
  });

  it('throws bus_in_maintenance when departureAt falls within maintenance window', async () => {
    mockRouteFindFirst.mockResolvedValue({ durationMinutes: 240 });
    wireTx({
      busLockRows: [
        {
          ...BASE_BUS_LOCK,
          maintenanceStart: new Date('2026-06-01T06:00:00Z'),
          maintenanceEnd: new Date('2026-06-01T10:00:00Z'),
        },
      ],
    });

    await expect(
      createTrip({
        operatorId: 'op-1',
        routeId: 'route-1',
        busId: 'bus-1',
        departureAt: new Date('2026-06-01T08:00:00Z'), // within window
        price: 100000,
      })
    ).rejects.toMatchObject({ code: 'bus_in_maintenance' });
  });

  it('does NOT throw bus_in_maintenance when departureAt is outside maintenance window', async () => {
    mockRouteFindFirst.mockResolvedValue({ durationMinutes: 240 });
    wireTx({
      busLockRows: [
        {
          ...BASE_BUS_LOCK,
          maintenanceStart: new Date('2026-06-01T06:00:00Z'),
          maintenanceEnd: new Date('2026-06-01T07:30:00Z'),
        },
      ],
      overlapRows: [],
    });

    const dto = await createTrip({
      operatorId: 'op-1',
      routeId: 'route-1',
      busId: 'bus-1',
      departureAt: new Date('2026-06-01T08:00:00Z'), // after window ends
      price: 100000,
    });

    expect(dto.status).toBe('scheduled');
  });

  it('throws bus_overlap when the bus already runs an overlapping trip', async () => {
    mockRouteFindFirst.mockResolvedValue({ durationMinutes: 240 });
    const { tripCreate } = wireTx({
      busLockRows: [BASE_BUS_LOCK],
      overlapRows: [{ id: 'other-trip' }], // overlap found
    });

    await expect(
      createTrip({
        operatorId: 'op-1',
        routeId: 'route-1',
        busId: 'bus-1',
        departureAt: new Date('2026-06-01T08:00:00Z'),
        price: 100000,
      })
    ).rejects.toMatchObject({ code: 'bus_overlap' });
    expect(tripCreate).not.toHaveBeenCalled();
  });
});
