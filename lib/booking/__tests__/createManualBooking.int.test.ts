/**
 * Integration tests for createManualBooking() (Issue 015).
 *
 * Verifies against a real Postgres DB:
 *   - Happy path: paid → booking status = paid_operator_notified, isManual=true
 *   - Happy path: cash → booking status = pending_cash_payment, isManual=true
 *   - AC1: sold_out when ticketCount > availableSeats
 *   - not_found: tenant isolation (wrong operatorId → 404)
 *   - trip_not_bookable: cancelled trip
 *   - trip_not_bookable: departed trip (departureAt in past)
 *   - Concurrent race: capacity-1 + 10 concurrent calls → exactly 1 succeeds
 *   - salesClosed bypass: operator can book even when salesClosed=true
 *   - 2 NotificationLog rows seeded 'pending'; afterFn dispatches to 'sent'
 *
 * Run with: pnpm test:integration
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '@/lib/db/client';
import { createManualBooking } from '../createManualBooking';

let operatorId: string;
let otherOperatorId: string;
let routeId: string;
let busId: string;
let tripId: string;

const CAPACITY = 5;

beforeAll(async () => {
  const operator = await prisma.operator.create({
    data: {
      legalName: 'ManualBooking Test Operator',
      contactPhone: '+8490xxxxxx5',
      contactEmail: 'test@manualbooking.test',
      notificationPhone: '+8490xxxxxx6',
    },
  });
  operatorId = operator.id;

  const otherOperator = await prisma.operator.create({
    data: {
      legalName: 'Other Operator',
      contactPhone: '+8490xxxxxx7',
      contactEmail: 'other@manualbooking.test',
    },
  });
  otherOperatorId = otherOperator.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: CAPACITY, licensePlate: 'MB-TEST-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: {
      origin: 'MB Test Origin',
      destination: 'MB Test Destination',
      operatorId,
      durationMinutes: 180,
    },
  });
  routeId = route.id;

  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      price: 150000,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  tripId = trip.id;
});

afterEach(async () => {
  await prisma.notificationLog.deleteMany({});
  await prisma.booking.deleteMany({ where: { tripId } });
  // Restore trip to known state
  await prisma.trip.update({
    where: { id: tripId },
    data: {
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'scheduled',
      salesClosed: false,
    },
  });
});

afterAll(async () => {
  await prisma.notificationLog.deleteMany({});
  await prisma.booking.deleteMany({ where: { tripId } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.operator.delete({ where: { id: otherOperatorId } });
  await prisma.$disconnect();
});

const BASE_INPUT = {
  tripId: '' as string, // filled in each test via tripId
  operatorId: '' as string, // filled in each test via operatorId
  buyerName: 'Nguyen Van A',
  buyerPhone: '0912345678',
  ticketCount: 1,
  paymentMethod: 'paid' as const,
};

describe('createManualBooking — happy path (paid)', () => {
  it('creates booking with paid_operator_notified status and isManual=true', async () => {
    const input = { ...BASE_INPUT, tripId, operatorId, paymentMethod: 'paid' as const };
    const result = await createManualBooking(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { booking } = result;
    expect(booking.status).toBe('paid_operator_notified');
    expect(booking.isManual).toBe(true);
    expect(booking.holdId).toBeNull();
    expect(booking.ticketCount).toBe(1);
    expect(booking.totalVnd).toBe(150000);
    expect(booking.buyerName).toBe('Nguyen Van A');
    expect(booking.bookingRef).toMatch(/^BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}$/);

    // 2 NotificationLog rows seeded pending
    const logs = await prisma.notificationLog.findMany({ where: { bookingId: booking.id } });
    expect(logs.length).toBe(2);
    const templates = logs.map((l) => l.template).sort();
    expect(templates).toContain('manualBookingPaid');
    expect(templates).toContain('operatorNewBooking');
    for (const log of logs) {
      expect(log.status).toBe('pending');
    }

    // afterFn dispatches to 'sent'
    await result.afterFn();
    const sentLogs = await prisma.notificationLog.findMany({ where: { bookingId: booking.id } });
    for (const log of sentLogs) {
      expect(log.status).toBe('sent');
      expect(log.externalRef).toMatch(/^stub_/);
    }
  });
});

describe('createManualBooking — happy path (cash)', () => {
  it('creates booking with pending_cash_payment status and isManual=true', async () => {
    const input = { ...BASE_INPUT, tripId, operatorId, paymentMethod: 'cash' as const };
    const result = await createManualBooking(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { booking } = result;
    expect(booking.status).toBe('pending_cash_payment');
    expect(booking.isManual).toBe(true);
    expect(booking.holdId).toBeNull();
    expect(booking.totalVnd).toBe(150000);

    // Customer SMS template should be manualBookingCash
    const logs = await prisma.notificationLog.findMany({ where: { bookingId: booking.id } });
    const templates = logs.map((l) => l.template).sort();
    expect(templates).toContain('manualBookingCash');
    expect(templates).toContain('operatorNewBooking');
  });
});

describe('createManualBooking — AC1: sold_out', () => {
  it('returns sold_out when ticketCount > availableSeats', async () => {
    const input = {
      ...BASE_INPUT,
      tripId,
      operatorId,
      ticketCount: CAPACITY + 1, // exceeds capacity
      paymentMethod: 'paid' as const,
    };
    const result = await createManualBooking(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('sold_out');
  });

  it('returns sold_out when existing bookings fill capacity', async () => {
    // Fill the trip to capacity first
    const fillResult = await createManualBooking({
      ...BASE_INPUT,
      tripId,
      operatorId,
      ticketCount: CAPACITY,
      paymentMethod: 'paid' as const,
    });
    expect(fillResult.ok).toBe(true);

    // Now try to book 1 more
    const result = await createManualBooking({
      ...BASE_INPUT,
      tripId,
      operatorId,
      ticketCount: 1,
      paymentMethod: 'cash' as const,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('sold_out');
  });
});

describe('createManualBooking — tenant isolation (not_found)', () => {
  it('returns not_found when operatorId does not match trip', async () => {
    const input = {
      ...BASE_INPUT,
      tripId,
      operatorId: otherOperatorId, // wrong operator
      paymentMethod: 'paid' as const,
    };
    const result = await createManualBooking(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('not_found');
  });

  it('returns not_found for a completely unknown tripId', async () => {
    const input = {
      ...BASE_INPUT,
      tripId: 'nonexistent-trip-id',
      operatorId,
      paymentMethod: 'paid' as const,
    };
    const result = await createManualBooking(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('not_found');
  });
});

describe('createManualBooking — state gates (trip_not_bookable)', () => {
  it('returns trip_not_bookable when trip is cancelled', async () => {
    await prisma.trip.update({ where: { id: tripId }, data: { status: 'cancelled' } });
    const result = await createManualBooking({ ...BASE_INPUT, tripId, operatorId });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('trip_not_bookable');
  });

  it('returns trip_not_bookable when trip departureAt is in the past', async () => {
    await prisma.trip.update({
      where: { id: tripId },
      data: { departureAt: new Date(Date.now() - 60_000) },
    });
    const result = await createManualBooking({ ...BASE_INPUT, tripId, operatorId });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('trip_not_bookable');
  });

  it('returns trip_not_bookable when trip is departed', async () => {
    await prisma.trip.update({ where: { id: tripId }, data: { status: 'departed' } });
    const result = await createManualBooking({ ...BASE_INPUT, tripId, operatorId });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('trip_not_bookable');
  });
});

describe('createManualBooking — salesClosed bypass', () => {
  it('succeeds even when salesClosed=true (operator override)', async () => {
    await prisma.trip.update({ where: { id: tripId }, data: { salesClosed: true } });
    const result = await createManualBooking({
      ...BASE_INPUT,
      tripId,
      operatorId,
      paymentMethod: 'paid' as const,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.booking.isManual).toBe(true);
  });
});

describe('createManualBooking — AC1 concurrent race', () => {
  it('capacity-1 + 10 concurrent calls → exactly 1 succeeds, 9 sold_out', async () => {
    // Set trip capacity to 1 via bus — use blockedSeats to effectively reduce to 1
    await prisma.trip.update({
      where: { id: tripId },
      data: { blockedSeats: CAPACITY - 1 }, // only 1 seat available
    });

    const promises = Array.from({ length: 10 }, () =>
      createManualBooking({
        ...BASE_INPUT,
        tripId,
        operatorId,
        ticketCount: 1,
        paymentMethod: 'paid' as const,
      })
    );
    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok) as Array<{ ok: false; reason: string }>;
    const soldOuts = failures.filter((r) => r.reason === 'sold_out');

    expect(successes.length).toBe(1);
    expect(soldOuts.length).toBe(9);

    // Restore blockedSeats
    await prisma.trip.update({ where: { id: tripId }, data: { blockedSeats: 0 } });
  }, 30_000);
});
