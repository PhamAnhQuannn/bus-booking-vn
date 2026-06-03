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
    booking: { aggregate: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    trip: { findFirst: vi.fn(), update: vi.fn() },
    notificationLog: { upsert: vi.fn() },
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
    booking: { aggregate: Mock; findMany: Mock; updateMany: Mock };
    trip: { findFirst: Mock; update: Mock };
    notificationLog: { upsert: Mock };
  };
};

const LOCKED_TRIP = [
  {
    id: 'trip-1',
    busId: 'bus-old',
    departureAt: new Date('2026-06-01T08:00:00Z'),
    blockedSeats: 0,
    durationMinutes: 240,
    origin: 'Hanoi',
    destination: 'Sapa',
  },
];

const BASE_BUS = {
  id: 'bus-new',
  capacity: 30,
  deactivatedAt: null,
  maintenanceStart: null,
  maintenanceEnd: null,
  licensePlate: '30A-99999',
  busType: 'coach',
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
    // 1st $queryRaw = trip lock; 2nd = overlap scan (busHasOverlappingTrip) → none
    p._txMock.$queryRaw
      .mockResolvedValueOnce(LOCKED_TRIP)
      .mockResolvedValueOnce([]);
    p._txMock.bus.findFirst.mockResolvedValue(BASE_BUS);
    p._txMock.hold.aggregate.mockResolvedValue(EMPTY_AGG);
    p._txMock.booking.aggregate.mockResolvedValue(EMPTY_AGG);
    p._txMock.trip.update.mockResolvedValue(UPDATED_TRIP);
    p._txMock.booking.findMany.mockResolvedValue([]);
    p._txMock.booking.updateMany.mockResolvedValue({ count: 0 });
    p._txMock.notificationLog.upsert.mockResolvedValue({});

    const dto = await reassignBus('op-1', 'trip-1', 'bus-new');
    expect(dto.busId).toBe('bus-new');
  });

  it('Issue 075: invalidates ticket PDFs + upserts busReassigned per affected paid booking', async () => {
    p._txMock.$queryRaw
      .mockResolvedValueOnce(LOCKED_TRIP)
      .mockResolvedValueOnce([]);
    p._txMock.bus.findFirst.mockResolvedValue(BASE_BUS);
    p._txMock.hold.aggregate.mockResolvedValue(EMPTY_AGG);
    p._txMock.booking.aggregate.mockResolvedValue(EMPTY_AGG);
    p._txMock.trip.update.mockResolvedValue(UPDATED_TRIP);
    // Two affected paid bookings on the trip
    p._txMock.booking.findMany.mockResolvedValue([
      { id: 'bk-1', bookingRef: 'BB-2026-aaaa-bbbb', buyerPhone: '+8490xxxxxx1' },
      { id: 'bk-2', bookingRef: 'BB-2026-cccc-dddd', buyerPhone: '+8490xxxxxx2' },
    ]);
    p._txMock.booking.updateMany.mockResolvedValue({ count: 2 });
    p._txMock.notificationLog.upsert.mockResolvedValue({});

    await reassignBus('op-1', 'trip-1', 'bus-new');

    // PDF invalidation: NULL the key for paid bookings that have one.
    expect(p._txMock.booking.updateMany).toHaveBeenCalledWith({
      where: {
        tripId: 'trip-1',
        status: { in: ['paid', 'completed', 'no_show'] },
        ticketPdfKey: { not: null },
      },
      data: { ticketPdfKey: null, ticketPdfGeneratedAt: null },
    });

    // One busReassigned upsert per affected paid booking, keyed on the compound unique.
    expect(p._txMock.notificationLog.upsert).toHaveBeenCalledTimes(2);
    const firstCall = p._txMock.notificationLog.upsert.mock.calls[0][0];
    expect(firstCall.where).toEqual({
      bookingId_template: { bookingId: 'bk-1', template: 'busReassigned' },
    });
    expect(firstCall.create).toMatchObject({
      bookingId: 'bk-1',
      channel: 'sms',
      template: 'busReassigned',
      recipient: '+8490xxxxxx1',
      status: 'pending',
    });
    // Payload carries the NEW plate + bus type + route + departure.
    const createPayload = JSON.parse(firstCall.create.payload);
    expect(createPayload).toMatchObject({
      bookingRef: 'BB-2026-aaaa-bbbb',
      plate: '30A-99999',
      busType: 'coach',
      route: 'Hanoi → Sapa',
    });
    // Update branch re-arms the row for re-delivery on a repeat reassign.
    expect(firstCall.update).toMatchObject({
      status: 'pending',
      attemptCount: 0,
      nextAttemptAt: null,
    });
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
    // 1st $queryRaw = trip lock; 2nd = overlap scan → conflicting trip found
    p._txMock.$queryRaw
      .mockResolvedValueOnce(LOCKED_TRIP)
      .mockResolvedValueOnce([{ id: 'conflicting-trip' }]);
    p._txMock.bus.findFirst.mockResolvedValue(BASE_BUS);
    p._txMock.hold.aggregate.mockResolvedValue(EMPTY_AGG);
    p._txMock.booking.aggregate.mockResolvedValue(EMPTY_AGG);

    await expect(reassignBus('op-1', 'trip-1', 'bus-busy')).rejects.toMatchObject({
      code: 'bus_overlap_with_outbound',
    });
  });
});
