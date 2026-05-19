/**
 * Unit tests for createTrip lib function (Issue 013 AC1).
 * All Prisma calls are mocked — no live DB needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock the prisma client before importing the module under test
vi.mock('@/lib/db/client', () => ({
  prisma: {
    bus: {
      findFirst: vi.fn(),
    },
    trip: {
      create: vi.fn(),
    },
  },
}));

import { createTrip } from '../createTrip';
import { TripServiceError } from '../errors';
import { prisma } from '@/lib/db/client';

const mockBusFindFirst = prisma.bus.findFirst as Mock;
const mockTripCreate = prisma.trip.create as Mock;

const BASE_BUS = {
  id: 'bus-1',
  capacity: 30,
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTrip', () => {
  it('creates a trip successfully', async () => {
    mockBusFindFirst.mockResolvedValue(BASE_BUS);
    mockTripCreate.mockResolvedValue(BASE_TRIP_ROW);

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

  it('throws not_found when bus does not belong to operator', async () => {
    mockBusFindFirst.mockResolvedValue(null);

    await expect(
      createTrip({
        operatorId: 'op-1',
        routeId: 'route-1',
        busId: 'other-bus',
        departureAt: new Date('2026-06-01T08:00:00Z'),
        price: 100000,
      })
    ).rejects.toThrow(TripServiceError);

    try {
      await createTrip({
        operatorId: 'op-1',
        routeId: 'route-1',
        busId: 'other-bus',
        departureAt: new Date('2026-06-01T08:00:00Z'),
        price: 100000,
      });
    } catch (e) {
      expect((e as TripServiceError).code).toBe('not_found');
    }
  });

  it('throws bus_deactivated when bus is deactivated', async () => {
    mockBusFindFirst.mockResolvedValue({
      ...BASE_BUS,
      deactivatedAt: new Date('2026-05-01'),
    });

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
    const maintenanceStart = new Date('2026-06-01T06:00:00Z');
    const maintenanceEnd = new Date('2026-06-01T10:00:00Z');
    const departureAt = new Date('2026-06-01T08:00:00Z'); // within window

    mockBusFindFirst.mockResolvedValue({
      ...BASE_BUS,
      maintenanceStart,
      maintenanceEnd,
    });

    await expect(
      createTrip({
        operatorId: 'op-1',
        routeId: 'route-1',
        busId: 'bus-1',
        departureAt,
        price: 100000,
      })
    ).rejects.toMatchObject({ code: 'bus_in_maintenance' });
  });

  it('does NOT throw bus_in_maintenance when departureAt is outside maintenance window', async () => {
    const maintenanceStart = new Date('2026-06-01T06:00:00Z');
    const maintenanceEnd = new Date('2026-06-01T07:30:00Z');
    const departureAt = new Date('2026-06-01T08:00:00Z'); // after window ends

    mockBusFindFirst.mockResolvedValue({
      ...BASE_BUS,
      maintenanceStart,
      maintenanceEnd,
    });
    mockTripCreate.mockResolvedValue(BASE_TRIP_ROW);

    const dto = await createTrip({
      operatorId: 'op-1',
      routeId: 'route-1',
      busId: 'bus-1',
      departureAt,
      price: 100000,
    });

    expect(dto.status).toBe('scheduled');
  });
});
