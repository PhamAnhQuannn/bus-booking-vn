/**
 * Unit tests for reassignBus lib function (Issue 013 AC3).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/db/client', () => {
  const txMock = {
    $queryRaw: vi.fn(),
    bus: { findFirst: vi.fn() },
    hold: { aggregate: vi.fn() },
    booking: { aggregate: vi.fn() },
    trip: { findFirst: vi.fn(), update: vi.fn() },
  };

  return {
    prisma: {
      $transaction: vi.fn((fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
      _txMock: txMock,
    },
  };
});

import { reassignBus } from '../reassignBus';
import { TripServiceError } from '../errors';
import { prisma } from '@/lib/db/client';

const p = prisma as unknown as {
  $transaction: Mock;
  _txMock: {
    $queryRaw: Mock;
    bus: { findFirst: Mock };
    hold: { aggregate: Mock };
    booking: { aggregate: Mock };
    trip: { findFirst: Mock; update: Mock };
  };
};

const LOCKED_TRIP = [
  {
    id: 'trip-1',
    busId: 'bus-old',
    departureAt: new Date('2026-06-01T08:00:00Z'),
    blockedSeats: 0,
  },
];

const BASE_BUS = {
  id: 'bus-new',
  capacity: 30,
  deactivatedAt: null,
  maintenanceStart: null,
  maintenanceEnd: null,
};

const EMPTY_AGG = { _sum: { ticketCount: null } };

const UPDATED_TRIP = {
  id: 'trip-1',
  routeId: 'r-1',
  busId: 'bus-new',
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reassignBus', () => {
  it('reassigns successfully when all checks pass', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_TRIP);
    p._txMock.bus.findFirst.mockResolvedValue(BASE_BUS);
    p._txMock.hold.aggregate.mockResolvedValue(EMPTY_AGG);
    p._txMock.booking.aggregate.mockResolvedValue(EMPTY_AGG);
    p._txMock.trip.findFirst.mockResolvedValue(null); // no overlap
    p._txMock.trip.update.mockResolvedValue(UPDATED_TRIP);

    const dto = await reassignBus('op-1', 'trip-1', 'bus-new');
    expect(dto.busId).toBe('bus-new');
  });

  it('throws not_found when trip does not belong to operator', async () => {
    p._txMock.$queryRaw.mockResolvedValue([]);

    await expect(reassignBus('op-1', 'trip-missing', 'bus-new')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('throws bus_deactivated when new bus is deactivated', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_TRIP);
    p._txMock.bus.findFirst.mockResolvedValue({
      ...BASE_BUS,
      deactivatedAt: new Date('2026-05-01'),
    });

    await expect(reassignBus('op-1', 'trip-1', 'bus-deact')).rejects.toMatchObject({
      code: 'bus_deactivated',
    });
  });

  it('throws bus_in_maintenance when new bus is in maintenance at departure', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_TRIP);
    p._txMock.bus.findFirst.mockResolvedValue({
      ...BASE_BUS,
      maintenanceStart: new Date('2026-06-01T06:00:00Z'),
      maintenanceEnd: new Date('2026-06-01T10:00:00Z'),
    });

    await expect(reassignBus('op-1', 'trip-1', 'bus-maint')).rejects.toMatchObject({
      code: 'bus_in_maintenance',
    });
  });

  it('throws capacity_too_small with required/provided meta when new bus is too small', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_TRIP);
    p._txMock.bus.findFirst.mockResolvedValue({ ...BASE_BUS, capacity: 5 });
    p._txMock.hold.aggregate.mockResolvedValue({ _sum: { ticketCount: 3 } });
    p._txMock.booking.aggregate.mockResolvedValue({ _sum: { ticketCount: 4 } });
    // required = 3+4+0=7 > capacity=5

    try {
      await reassignBus('op-1', 'trip-1', 'bus-small');
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as TripServiceError).code).toBe('capacity_too_small');
      expect((e as TripServiceError).meta?.required).toBe(7);
      expect((e as TripServiceError).meta?.provided).toBe(5);
    }
  });

  it('throws bus_overlap_with_outbound when new bus has conflicting trip', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_TRIP);
    p._txMock.bus.findFirst.mockResolvedValue(BASE_BUS);
    p._txMock.hold.aggregate.mockResolvedValue(EMPTY_AGG);
    p._txMock.booking.aggregate.mockResolvedValue(EMPTY_AGG);
    p._txMock.trip.findFirst.mockResolvedValue({ id: 'conflicting-trip' }); // overlap found

    await expect(reassignBus('op-1', 'trip-1', 'bus-busy')).rejects.toMatchObject({
      code: 'bus_overlap_with_outbound',
    });
  });
});
