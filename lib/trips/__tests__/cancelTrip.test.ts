/**
 * Unit tests for cancelTrip lib function (Issue 013 AC4).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/core/db/client', () => {
  const txMock = {
    $queryRaw: vi.fn(),
    trip: { update: vi.fn(), findUnique: vi.fn() },
    booking: { findMany: vi.fn(), updateMany: vi.fn() },
    hold: { updateMany: vi.fn() },
    route: { findUnique: vi.fn() },
    notificationLog: { createMany: vi.fn() },
    refundObligation: { createMany: vi.fn() },
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
import { prisma } from '@/lib/core/db/client';

const p = prisma as unknown as {
  $transaction: Mock;
  _txMock: {
    $queryRaw: Mock;
    trip: { update: Mock; findUnique: Mock };
    booking: { findMany: Mock; updateMany: Mock };
    hold: { updateMany: Mock };
    route: { findUnique: Mock };
    notificationLog: { createMany: Mock };
    refundObligation: { createMany: Mock };
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
    buyerEmail: 'rider1@example.com',
    customerId: 'cust-1',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    bookingRef: 'BB-2026-abc2-def3',
    buyerPhone: '+8490xxxxxx2',
    buyerEmail: null,
    customerId: null,
  },
];

const PAID_BOOKINGS = [
  { id: '550e8400-e29b-41d4-a716-446655440000', totalVnd: 180000, paymentExternalRef: 'txn-1' },
  { id: '550e8400-e29b-41d4-a716-446655440001', totalVnd: 90000, paymentExternalRef: null },
];

describe('cancelTrip', () => {
  it('cancels successfully and returns counts', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_SCHEDULED);
    p._txMock.trip.update.mockResolvedValue(UPDATED_TRIP_ROW);
    // findMany is called twice: (1) affected bookings for notifications,
    // (2) Issue 051 paid bookings for refund-out.
    p._txMock.booking.findMany
      .mockResolvedValueOnce(AFFECTED_BOOKINGS)
      .mockResolvedValueOnce(PAID_BOOKINGS);
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

  it('#835: enqueues a RefundObligation per paid booking INSIDE the tx with the cancel-scoped key', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_SCHEDULED);
    p._txMock.trip.update.mockResolvedValue(UPDATED_TRIP_ROW);
    p._txMock.booking.findMany
      .mockResolvedValueOnce(AFFECTED_BOOKINGS)
      .mockResolvedValueOnce(PAID_BOOKINGS);
    p._txMock.booking.updateMany.mockResolvedValue({ count: 2 });
    p._txMock.hold.updateMany.mockResolvedValue({ count: 0 });
    p._txMock.route.findUnique.mockResolvedValue({ origin: 'HN', destination: 'HCM' });
    p._txMock.notificationLog.createMany.mockResolvedValue({ count: 2 });

    await cancelTrip('op-1', 'trip-1', 'Equipment failure requiring repair');

    expect(p._txMock.refundObligation.createMany).toHaveBeenCalledWith({
      data: [
        {
          bookingId: PAID_BOOKINGS[0].id,
          amountMinor: 180000,
          reason: 'operator_cancel',
          idempotencyKey: `cancel:trip-1:${PAID_BOOKINGS[0].id}`,
          providerTxnId: 'txn-1',
        },
        {
          bookingId: PAID_BOOKINGS[1].id,
          amountMinor: 90000,
          reason: 'operator_cancel',
          idempotencyKey: `cancel:trip-1:${PAID_BOOKINGS[1].id}`,
          providerTxnId: 'cancel:trip-1',
        },
      ],
      skipDuplicates: true,
    });
  });

  it('#835: a failing obligation insert fails the whole cancel tx (no inline best-effort refund)', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_SCHEDULED);
    p._txMock.trip.update.mockResolvedValue(UPDATED_TRIP_ROW);
    p._txMock.booking.findMany
      .mockResolvedValueOnce(AFFECTED_BOOKINGS)
      .mockResolvedValueOnce(PAID_BOOKINGS);
    p._txMock.booking.updateMany.mockResolvedValue({ count: 2 });
    p._txMock.hold.updateMany.mockResolvedValue({ count: 0 });
    p._txMock.route.findUnique.mockResolvedValue({ origin: 'HN', destination: 'HCM' });
    p._txMock.notificationLog.createMany.mockResolvedValue({ count: 2 });
    p._txMock.refundObligation.createMany.mockRejectedValueOnce(new Error('db blip'));

    await expect(cancelTrip('op-1', 'trip-1', 'Equipment failure requiring repair')).rejects.toThrow('db blip');
  });

  it('no paid bookings -> no RefundObligation insert', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_SCHEDULED);
    p._txMock.trip.update.mockResolvedValue(UPDATED_TRIP_ROW);
    p._txMock.booking.findMany
      .mockResolvedValueOnce([AFFECTED_BOOKINGS[0]])
      .mockResolvedValueOnce([]);
    p._txMock.booking.updateMany.mockResolvedValue({ count: 1 });
    p._txMock.hold.updateMany.mockResolvedValue({ count: 0 });
    p._txMock.route.findUnique.mockResolvedValue({ origin: 'HN', destination: 'HCM' });
    p._txMock.notificationLog.createMany.mockResolvedValue({ count: 1 });

    await cancelTrip('op-1', 'trip-1', 'Equipment failure requiring repair');

    expect(p._txMock.refundObligation.createMany).not.toHaveBeenCalled();
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

  it('#834: emails buyers who left an email, SMS otherwise; body is a rendered sentence, not JSON', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_SCHEDULED);
    p._txMock.trip.update.mockResolvedValue(UPDATED_TRIP_ROW);
    p._txMock.booking.findMany
      .mockResolvedValueOnce(AFFECTED_BOOKINGS)
      .mockResolvedValueOnce([PAID_BOOKINGS[0]]);
    p._txMock.booking.updateMany.mockResolvedValue({ count: 2 });
    p._txMock.hold.updateMany.mockResolvedValue({ count: 0 });
    p._txMock.route.findUnique.mockResolvedValue({ origin: 'HN', destination: 'HCM' });
    p._txMock.notificationLog.createMany.mockResolvedValue({ count: 2 });

    await cancelTrip('op-1', 'trip-1', 'Equipment failure requiring repair');

    const [emailRow, smsRow] = p._txMock.notificationLog.createMany.mock.calls[0][0].data;
    expect(emailRow).toMatchObject({ channel: 'email', template: 'trip_cancelled', recipient: 'rider1@example.com' });
    expect(smsRow).toMatchObject({ channel: 'sms', template: 'trip_cancelled', recipient: '+8490xxxxxx2' });
    for (const row of [emailRow, smsRow]) {
      expect(() => JSON.parse(row.payload)).toThrow();
      expect(row.payload).toContain('HN → HCM');
      expect(row.payload).toContain('da bi nha xe huy');
    }
    // Paid booking is promised the refund; the never-paid one is told there is no charge.
    expect(emailRow.payload).toContain('hoan lai 100%');
    expect(smsRow.payload).toContain('khong bi tinh phi');
  });

  it('notification payload does not contain the raw phone (I9)', async () => {
    p._txMock.$queryRaw.mockResolvedValue(LOCKED_SCHEDULED);
    p._txMock.trip.update.mockResolvedValue(UPDATED_TRIP_ROW);
    p._txMock.booking.findMany.mockResolvedValue([AFFECTED_BOOKINGS[1]]);
    p._txMock.booking.updateMany.mockResolvedValue({ count: 1 });
    p._txMock.hold.updateMany.mockResolvedValue({ count: 0 });
    p._txMock.route.findUnique.mockResolvedValue({ origin: 'HN', destination: 'HCM' });
    p._txMock.notificationLog.createMany.mockResolvedValue({ count: 1 });

    await cancelTrip('op-1', 'trip-1', 'Equipment failure requiring repair');

    const logEntry = p._txMock.notificationLog.createMany.mock.calls[0][0].data[0];
    expect(logEntry.payload).not.toContain('+8490xxxxxx2');
    expect(logEntry.recipient).toBe('+8490xxxxxx2');
    expect(logEntry.payload).toContain(AFFECTED_BOOKINGS[1].bookingRef);
  });
});
