/**
 * Integration tests for Issue 014 operator booking queue READ views.
 *
 * Online-only (Issue 039): the cash/call-to-confirm mutation services
 * (recordCallOutcome / recordEscalation / markPickedUp / recordCashCollected)
 * were removed; their tests went with them. Only the read/list views remain.
 *
 * Run with: pnpm vitest:int
 *
 * Covers:
 * - listOperatorBookings: filter combination (AC2) + tenant isolation
 * - getOperatorBooking: tenant isolation 404
 * - getManifest: NO seatNumber field in output (AC6) + tenant isolation
 * - getUnviewedPaidCount: badge count correctness
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/client';
import { randomUUID } from 'crypto';
import { listOperatorBookings } from '../listOperatorBookings';
import { getOperatorBooking } from '../getOperatorBooking';
import { getUnviewedPaidCount } from '../getUnviewedPaidCount';
import { getManifest } from '@/lib/manifest/getManifest';

// ────────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────────

let operatorId: string;
let otherOperatorId: string;
let operatorUserId: string;
let routeId: string;
let busId: string;
let tripId: string;
let otherTripId: string;

// Bookings
let paidBookingId: string;
let manualBookingId: string;
let cancelledBookingId: string;

function makeUuidBooking(ref: string, tripIdParam: string, opts: {
  status?: string;
  paymentMethod?: string;
  isManual?: boolean;
  contactStatus?: string;
} = {}) {
  const id = randomUUID();
  return prisma.booking.create({
    data: {
      id,
      bookingRef: ref,
      confirmationToken: 'tok-' + randomUUID(),
      tripId: tripIdParam,
      buyerName: 'Test Buyer',
      buyerPhone: '+8490xxxxxx1',
      ticketCount: 2,
      totalVnd: 200_000,
      paymentMethod: (opts.paymentMethod ?? 'momo') as 'momo' | 'zalopay' | 'card',
      status: (opts.status ?? 'paid') as 'paid' | 'completed' | 'awaiting_payment' | 'cancelled' | 'trip_cancelled' | 'no_show' | 'payment_failed_expired',
      isManual: opts.isManual ?? false,
      contactStatus: (opts.contactStatus ?? 'pending') as 'pending' | 'reached' | 'no_answer' | 'callback',
    },
  }).then((b) => b.id);
}

beforeAll(async () => {
  // Operator A
  const op = await prisma.operator.create({
    data: {
      legalName: 'Queue Test Op A',
      contactPhone: '+8490xxxxxx3',
      contactEmail: 'qa@queuetest.dev',
    },
  });
  operatorId = op.id;

  // Operator B (for tenant isolation tests)
  const opB = await prisma.operator.create({
    data: {
      legalName: 'Queue Test Op B',
      contactPhone: '+8490xxxxxx4',
      contactEmail: 'qb@queuetest.dev',
    },
  });
  otherOperatorId = opB.id;

  // OperatorUser for badge tests
  const opUser = await prisma.operatorUser.create({
    data: {
      operatorId,
      phone: '+8490xxxxxx5',
      contactPhone: '+8490xxxxxx6',
      notificationPhone: '+8490xxxxxx7',
      passwordHash: 'a'.repeat(64),
      displayName: 'Queue Tester',
      requiresPasswordChange: false,
    },
  });
  operatorUserId = opUser.id;

  // Route + Bus for Op A
  const route = await prisma.route.create({
    data: {
      origin: 'Queue Origin',
      destination: 'Queue Destination',
      operatorId,
      durationMinutes: 120,
    },
  });
  routeId = route.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 30, licensePlate: 'QUEUE-001', busType: 'coach' },
  });
  busId = bus.id;

  // Trip for Op A (future)
  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: new Date(Date.now() + 2 * 86_400_000),
      price: 100_000,
    },
  });
  tripId = trip.id;

  // Trip for Op B (tenant isolation)
  const busB = await prisma.bus.create({
    data: { operatorId: otherOperatorId, capacity: 20, licensePlate: 'QUEUE-B01', busType: 'coach' },
  });
  const routeB = await prisma.route.create({
    data: {
      origin: 'B Origin',
      destination: 'B Destination',
      operatorId: otherOperatorId,
      durationMinutes: 60,
    },
  });
  const otherTrip = await prisma.trip.create({
    data: {
      routeId: routeB.id,
      busId: busB.id,
      operatorId: otherOperatorId,
      departureAt: new Date(Date.now() + 86_400_000),
      price: 80_000,
    },
  });
  otherTripId = otherTrip.id;

  // Paid booking (momo, paid)
  paidBookingId = await makeUuidBooking('BB-2026-qut1-aaa1', tripId, {
    status: 'paid',
    paymentMethod: 'momo',
  });

  // Manual booking (paid, operator-flagged)
  manualBookingId = await makeUuidBooking('BB-2026-qut1-bbb2', tripId, {
    status: 'paid',
    paymentMethod: 'momo',
    isManual: true,
  });

  // Cancelled booking (should NOT appear in queue)
  cancelledBookingId = await makeUuidBooking('BB-2026-qut1-ccc3', tripId, {
    status: 'cancelled',
    paymentMethod: 'momo',
  });

  // Booking on Op B's trip (for tenant isolation)
  await makeUuidBooking('BB-2026-qut2-ddd4', otherTripId, {
    status: 'paid',
    paymentMethod: 'momo',
  });
});

afterAll(async () => {
  // Cleanup in reverse FK order
  await prisma.notificationLog.deleteMany({ where: { booking: { trip: { operatorId: { in: [operatorId, otherOperatorId] } } } } });
  await prisma.booking.deleteMany({ where: { trip: { operatorId: { in: [operatorId, otherOperatorId] } } } });
  await prisma.trip.deleteMany({ where: { operatorId: { in: [operatorId, otherOperatorId] } } });
  await prisma.route.deleteMany({ where: { operatorId: { in: [operatorId, otherOperatorId] } } });
  await prisma.bus.deleteMany({ where: { operatorId: { in: [operatorId, otherOperatorId] } } });
  await prisma.operatorUser.deleteMany({ where: { operatorId: { in: [operatorId, otherOperatorId] } } });
  await prisma.operator.deleteMany({ where: { id: { in: [operatorId, otherOperatorId] } } });
});

// ────────────────────────────────────────────────────────────────────────────
// listOperatorBookings
// ────────────────────────────────────────────────────────────────────────────

describe('listOperatorBookings', () => {
  it('returns only paid-status bookings for the operator', async () => {
    const result = await listOperatorBookings(operatorId, {});
    const ids = result.rows.map((r) => r.id);

    expect(ids).toContain(paidBookingId);
    expect(ids).toContain(manualBookingId);
    // cancelled booking excluded
    expect(ids).not.toContain(cancelledBookingId);
  });

  it('tenant isolation: only shows bookings for correct operator', async () => {
    const result = await listOperatorBookings(operatorId, {});
    // None of the rows should belong to other operator's trip
    for (const row of result.rows) {
      // All returned bookings are on tripId (Op A)
      const booking = await prisma.booking.findUnique({ where: { id: row.id }, select: { trip: { select: { operatorId: true } } } });
      expect(booking?.trip.operatorId).toBe(operatorId);
    }
  });

  it('AC2: filter by contactStatus', async () => {
    // Set one booking to 'reached'
    await prisma.booking.update({ where: { id: paidBookingId }, data: { contactStatus: 'reached' } });

    const reached = await listOperatorBookings(operatorId, { contactStatus: 'reached' });
    const pending = await listOperatorBookings(operatorId, { contactStatus: 'pending' });

    expect(reached.rows.some((r) => r.id === paidBookingId)).toBe(true);
    expect(pending.rows.some((r) => r.id === paidBookingId)).toBe(false);

    // Reset
    await prisma.booking.update({ where: { id: paidBookingId }, data: { contactStatus: 'pending' } });
  });

  it('AC2: filter by busId', async () => {
    const result = await listOperatorBookings(operatorId, { busId: busId });
    expect(result.rows.length).toBeGreaterThan(0);
    // Non-existent bus should return empty
    const empty = await listOperatorBookings(operatorId, { busId: 'nonexistent-bus' });
    expect(empty.rows.length).toBe(0);
  });

  it('AC2: filter by serviceDate', async () => {
    const departureInstantMs = Date.now() + 2 * 86_400_000;
    const vnDateStr = new Date(departureInstantMs + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const result = await listOperatorBookings(operatorId, { serviceDate: vnDateStr });
    expect(result.rows.length).toBeGreaterThan(0);

    // Past date returns empty
    const empty = await listOperatorBookings(operatorId, { serviceDate: '2020-01-01' });
    expect(empty.rows.length).toBe(0);
  });

  it('AC2 timezone: trip at Vietnam 01:00 (UTC 18:00 prev day) matches VN serviceDate, not UTC date', async () => {
    // Vietnam 2026-06-01 01:00 = UTC 2026-05-31 18:00:00
    // The UTC-midnight-based bug would put this in serviceDate='2026-05-31' (UTC day)
    // The correct VN-local window puts it in serviceDate='2026-06-01' (VN day)
    const vnMidnightCrossTrip = await prisma.trip.create({
      data: {
        routeId,
        busId,
        operatorId,
        // UTC 2026-05-31T18:00:00Z = VN 2026-06-01T01:00:00+07:00
        departureAt: new Date('2026-05-31T18:00:00.000Z'),
        price: 100_000,
        status: 'scheduled',
        salesClosed: false,
      },
    });

    const crossBookingId = await makeUuidBooking('BB-2026-tz01-aaa1', vnMidnightCrossTrip.id, {
      status: 'paid',
      paymentMethod: 'momo',
    });

    // Should match VN date '2026-06-01', NOT '2026-05-31'
    const vnResult = await listOperatorBookings(operatorId, { serviceDate: '2026-06-01' });
    expect(vnResult.rows.some((r) => r.id === crossBookingId)).toBe(true);

    const utcResult = await listOperatorBookings(operatorId, { serviceDate: '2026-05-31' });
    expect(utcResult.rows.some((r) => r.id === crossBookingId)).toBe(false);

    // Cleanup
    await prisma.booking.delete({ where: { id: crossBookingId } });
    await prisma.trip.delete({ where: { id: vnMidnightCrossTrip.id } });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getOperatorBooking
// ────────────────────────────────────────────────────────────────────────────

describe('getOperatorBooking', () => {
  it('returns full booking DTO for own operator', async () => {
    const booking = await getOperatorBooking(operatorId, paidBookingId);
    expect(booking).not.toBeNull();
    expect(booking?.id).toBe(paidBookingId);
    expect(booking).toHaveProperty('contactStatus');
    expect(booking).toHaveProperty('pickupPointId');
    expect(booking).toHaveProperty('escalationNote');
  });

  it('tenant isolation: returns null for cross-operator booking', async () => {
    // Try to access Op B booking with Op A credentials
    const allBBookings = await prisma.booking.findMany({
      where: { trip: { operatorId: otherOperatorId } },
      select: { id: true },
    });
    if (allBBookings.length > 0) {
      const result = await getOperatorBooking(operatorId, allBBookings[0].id);
      expect(result).toBeNull();
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getManifest (AC6)
// ────────────────────────────────────────────────────────────────────────────

describe('getManifest', () => {
  it('AC6: NO seatNumber field in output', async () => {
    const manifest = await getManifest(operatorId, tripId);
    expect(manifest).not.toBeNull();
    for (const row of manifest!.rows) {
      expect(row).not.toHaveProperty('seatNumber');
    }
  });

  it('returns generatedAt timestamp (AC7)', async () => {
    const manifest = await getManifest(operatorId, tripId);
    expect(manifest?.generatedAt).toBeDefined();
    const dt = new Date(manifest!.generatedAt);
    expect(dt.getTime()).not.toBeNaN();
  });

  it('tenant isolation: returns null for cross-operator trip', async () => {
    const result = await getManifest(operatorId, otherTripId);
    expect(result).toBeNull();
  });

  it('includes manualFlag', async () => {
    const manifest = await getManifest(operatorId, tripId);
    // paidBookingId is a non-manual online booking — manualFlag false
    const onlineRow = manifest?.rows.find((r) => r.manualFlag === false);
    expect(onlineRow).toBeDefined();
    // manualBookingId is operator-flagged — manualFlag true
    const manualRow = manifest?.rows.find((r) => r.manualFlag === true);
    expect(manualRow).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getUnviewedPaidCount (AC1 badge)
// ────────────────────────────────────────────────────────────────────────────

describe('getUnviewedPaidCount', () => {
  it('returns count of paid bookings when lastBookingsViewedAt is null', async () => {
    // operatorUserId has no lastBookingsViewedAt set (null)
    const count = await getUnviewedPaidCount(operatorUserId, operatorId);
    // Should be at least the paid bookings we created
    expect(count).toBeGreaterThan(0);
  });

  it('returns 0 for bookings created before last viewed', async () => {
    // Touch to now
    await prisma.operatorUser.update({
      where: { id: operatorUserId },
      data: { lastBookingsViewedAt: new Date() },
    });
    // No new bookings created after this point
    const count = await getUnviewedPaidCount(operatorUserId, operatorId);
    expect(count).toBe(0);
  });

  it('returns correct count for new bookings after last viewed', async () => {
    // Create a new booking after touch
    const newId = await makeUuidBooking('BB-2026-qut1-hhh8', tripId, {
      status: 'paid',
      paymentMethod: 'momo',
    });
    const count = await getUnviewedPaidCount(operatorUserId, operatorId);
    expect(count).toBeGreaterThanOrEqual(1);
    // Cleanup
    await prisma.booking.delete({ where: { id: newId } });
  });
});
