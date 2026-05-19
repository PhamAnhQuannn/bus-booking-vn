/**
 * Unit tests for cancelTrip lib function (Issue 013 AC4).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/db/client', () => {
  const txMock = {
    $queryRaw: vi.fn(),
    trip: { update: vi.fn(), findUnique: vi.fn() },
    booking: { findMany: vi.fn(), updateMany: vi.fn() },
    hold: { updateMany: vi.fn() },
    route: { findUnique: vi.fn() },
    notificationLog: { createMany: vi.fn() },
  };

  return {
    prisma: {
      $transaction: vi.fn((fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
      _txMock: txMock,
    },
  };
});

import { cancelTrip } from '../cancelTrip';
import { TripServiceError } from '../errors';
import { prisma } from '@/lib/db/client';

const p = prisma as unknown as {
  $transaction: Mock;
  _txMock: {
    $queryRaw: Mock;
    trip: { update: Mock; findUnique: Mock };
    booking: { findMany: Mock; updateMany: Mock };
    hold: { updateMany: Mock };
    route: { findUnique: Mock };
    notificationLog: { createMany: Mock };
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

const LOCKED_SCHEDULED = [
  {
    id: 'trip-1',
    status: 'scheduled',
    routeId: 'route-1',
    departureAt: new Date('2026-06-01T08:00:00Z'),
  },
];

const LOCKED_CANCELLED = [
  {
    id: 'trip-1',
    status: 'cancelled',
    routeId: 'route-1',
    departureAt: new Date('2026-06-01T08:00:00Z'),
  },
];

// Full Trip row shape returned by findUnique (used in already_cancelled path)
const CANCELLED_TRIP_ROW = {
  id: 'trip-1',
  routeId: 'route-1',
  busId: 'bus-1',
  operatorId: 'op-1',
  departureAt: new Date('2026-06-01T08:00:00Z'),
  price: 90000,
  status: 'cancelled',
  salesClosed: false,
  blockedSeats: 0,
  recurringTemplateId: null,
  pairedTripId: null,
  cancelReason: 'Equipment failure requiring repair',
  cancelledAt: new Date('2026-06-01T07:00:00Z'),
  bus: { capacity: 30 },
  _count: { holds: 0, bookings: 0 },
};

// Full Trip row shape returned by trip.update after a fresh cancel
const UPDATED_TRIP_ROW = {
  ...CANCELLED_TRIP_ROW,
  cancelReason: 'Equipment failure requiring repair',
  cancelledAt: new Date(),
};

const AFFECTED_BOOKINGS = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    bookingRef: 'BB-2026-abc1-def2',
    buyerPhone: '+8490xxxxxx1',
    customerId: 'cust-1',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    bookingRef: 'BB-2026-abc2-def3',
    buyerPhone: '+8490xxxxxx2',
    customerId: null,
  },
];

describe('cancelTrip', () => {
  it('cancels successfully and returns counts', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_SCHEDULED);
    p._txMock.trip.update.mockResolvedValue(UPDATED_TRIP_ROW);
    p._txMock.booking.findMany.mockResolvedValue(AFFECTED_BOOKINGS);
    p._txMock.booking.updateMany.mockResolvedValue({ count: 2 });
    p._txMock.hold.updateMany.mockResolvedValue({ count: 1 });
    p._txMock.route.findUnique.mockResolvedValue({ origin: 'HN', destination: 'HCM' });
    p._txMock.notificationLog.createMany.mockResolvedValue({ count: 2 });

    const result = await cancelTrip('op-1', 'trip-1', 'Equipment failure requiring repair');

    expect(result.alreadyCancelled).toBe(false);
    expect(result.cancelledBookings).toBe(2);
    expect(result.cancelledHolds).toBe(1);
    expect(result.notificationsEnqueued).toBe(2);
    expect(result.trip.id).toBe('trip-1');
    expect(result.trip.status).toBe('cancelled');
  });

  it('throws not_found for cross-operator or missing trip', async () => {
    p._txMock.$queryRaw.mockResolvedValue([]);

    await expect(
      cancelTrip('op-1', 'trip-missing', 'Valid reason text here')
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('returns alreadyCancelled:true with trip DTO when trip is already cancelled (AC3 idempotent re-cancel)', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_CANCELLED);
    p._txMock.trip.findUnique.mockResolvedValue(CANCELLED_TRIP_ROW);

    const result = await cancelTrip('op-1', 'trip-1', 'Trying to cancel twice here');

    expect(result.alreadyCancelled).toBe(true);
    expect(result.trip.id).toBe('trip-1');
    expect(result.trip.status).toBe('cancelled');
    expect(result.cancelledBookings).toBe(0);
    expect(result.cancelledHolds).toBe(0);
    expect(result.notificationsEnqueued).toBe(0);
    // No update or booking/hold mutation should happen on idempotent re-cancel
    expect(p._txMock.trip.update).not.toHaveBeenCalled();
    expect(p._txMock.booking.updateMany).not.toHaveBeenCalled();
    expect(p._txMock.hold.updateMany).not.toHaveBeenCalled();
  });

  it('enqueues zero notifications when no affected bookings', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_SCHEDULED);
    p._txMock.trip.update.mockResolvedValue(UPDATED_TRIP_ROW);
    p._txMock.booking.findMany.mockResolvedValue([]);
    p._txMock.booking.updateMany.mockResolvedValue({ count: 0 });
    p._txMock.hold.updateMany.mockResolvedValue({ count: 3 });
    p._txMock.route.findUnique.mockResolvedValue({ origin: 'HN', destination: 'HCM' });

    const result = await cancelTrip('op-1', 'trip-1', 'No passengers on this trip today');

    expect(result.alreadyCancelled).toBe(false);
    expect(result.cancelledBookings).toBe(0);
    expect(result.cancelledHolds).toBe(3);
    expect(result.notificationsEnqueued).toBe(0);
    // createMany should NOT be called with empty array
    expect(p._txMock.notificationLog.createMany).not.toHaveBeenCalled();
  });

  it('notification payload does not contain raw phone (I9)', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_SCHEDULED);
    p._txMock.trip.update.mockResolvedValue(UPDATED_TRIP_ROW);
    p._txMock.booking.findMany.mockResolvedValue([AFFECTED_BOOKINGS[0]]);
    p._txMock.booking.updateMany.mockResolvedValue({ count: 1 });
    p._txMock.hold.updateMany.mockResolvedValue({ count: 0 });
    p._txMock.route.findUnique.mockResolvedValue({ origin: 'HN', destination: 'HCM' });
    p._txMock.notificationLog.createMany.mockResolvedValue({ count: 1 });

    await cancelTrip('op-1', 'trip-1', 'Equipment failure requiring repair');

    const callArgs = p._txMock.notificationLog.createMany.mock.calls[0][0];
    const logEntry = callArgs.data[0];

    // Parse the payload and ensure phone is NOT in it (I9 compliance)
    const payload = JSON.parse(logEntry.payload);
    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('buyerPhone');
    expect(payload).not.toHaveProperty('recipientPhone');
    // But the recipient column (not in payload) should hold the phone
    expect(logEntry.recipient).toBe('+8490xxxxxx1');
    // Payload should have route info
    expect(payload).toHaveProperty('bookingRef');
    expect(payload).toHaveProperty('route');
    expect(payload).toHaveProperty('departureAt');
  });
});
