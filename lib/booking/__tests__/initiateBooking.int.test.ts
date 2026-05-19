/**
 * Integration tests for initiateCashBooking().
 *
 * Verifies orchestration of the cash path end-to-end against a real database:
 *   - happy path  → booking created, 2 NotificationLog rows seeded 'pending'
 *     synchronously, then transitioned to 'sent' once the deferred afterFn
 *     callback runs (we inject a collector instead of next/server's `after`
 *     so the test can drive dispatch deterministically).
 *   - hold_not_found, hold_expired, trip_departed disambiguation
 *   - already_booked idempotency — second call recovers existing booking
 *
 * Run with: pnpm test:integration
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '@/lib/db/client';
import { createHold } from '@/lib/db/holdRepo';
import { initiateCashBooking } from '../initiateBooking';

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;

const BASE_URL = 'http://localhost:3000';

beforeAll(async () => {
  expect(process.env.ESMS_API_KEY).toBeUndefined();

  const operator = await prisma.operator.create({
    data: {
      legalName: 'InitiateBooking Test Operator',
      contactPhone: '+8490xxxxxx3',
      contactEmail: 'test@initiate.test',
      notificationPhone: '+8490xxxxxx4',
    },
  });
  operatorId = operator.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 10, licensePlate: 'TEST-IB-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: { origin: 'IB Test Origin', destination: 'IB Test Destination' },
  });
  routeId = route.id;

  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      price: 100000,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  tripId = trip.id;
});

afterEach(async () => {
  await prisma.notificationLog.deleteMany({});
  await prisma.booking.deleteMany({ where: { tripId } });
  await prisma.hold.deleteMany({ where: { tripId } });
  // Restore trip.departureAt to a known-future value in case a test mutated it.
  await prisma.trip.update({
    where: { id: tripId },
    data: { departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
});

afterAll(async () => {
  await prisma.notificationLog.deleteMany({});
  await prisma.booking.deleteMany({ where: { tripId } });
  await prisma.hold.deleteMany({ where: { tripId } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

async function activeHold(ticketCount = 1): Promise<string> {
  const h = await createHold({
    tripId,
    ticketCount,
    customerPhone: '+8490xxxxxx1',
    customerName: 'Hold Holder',
  });
  if (!h) throw new Error('hold setup failed');
  return h.holdId;
}

interface AfterCollector {
  callbacks: Array<() => Promise<void>>;
  fn: (cb: () => Promise<void>) => void;
}

function collector(): AfterCollector {
  const callbacks: Array<() => Promise<void>> = [];
  return {
    callbacks,
    fn: (cb) => {
      callbacks.push(cb);
    },
  };
}

describe('initiateCashBooking — happy path', () => {
  it('creates booking, seeds 2 pending notifications, dispatches on afterFn', async () => {
    const holdId = await activeHold(2);
    const c = collector();

    const r = await initiateCashBooking({ holdId, baseUrl: BASE_URL, afterFn: c.fn });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bookingId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(r.confirmationToken).toMatch(/^[A-Za-z0-9_-]{32}$/);

    const booking = await prisma.booking.findUnique({ where: { id: r.bookingId } });
    expect(booking).not.toBeNull();
    expect(booking?.holdId).toBe(holdId);
    expect(booking?.status).toBe('pending_cash_payment');
    expect(booking?.paymentMethod).toBe('cash');
    expect(booking?.ticketCount).toBe(2);
    expect(booking?.totalVnd).toBe(200000);

    // Hold should be flipped to converted (via createCashBookingFromHold)
    const hold = await prisma.hold.findUnique({ where: { id: holdId } });
    expect(hold?.status).toBe('converted');

    // Notifications seeded pending, sync
    const pendingLogs = await prisma.notificationLog.findMany({
      where: { bookingId: r.bookingId },
      orderBy: { template: 'asc' },
    });
    expect(pendingLogs.length).toBe(2);
    const templates = pendingLogs.map((l) => l.template).sort();
    expect(templates).toEqual(['bookingPendingCash', 'operatorNewBooking']);
    for (const log of pendingLogs) {
      expect(log.status).toBe('pending');
      expect(log.externalRef).toBeNull();
      expect(log.sentAt).toBeNull();
    }
    // Recipient correctness:
    const customerLog = pendingLogs.find((l) => l.template === 'bookingPendingCash');
    const operatorLog = pendingLogs.find((l) => l.template === 'operatorNewBooking');
    expect(customerLog?.recipient).toBe('+8490xxxxxx1');
    // Operator uses notificationPhone if set, falls back to contactPhone.
    expect(operatorLog?.recipient).toBe('+8490xxxxxx4');

    // Drain deferred work
    expect(c.callbacks.length).toBe(1);
    for (const cb of c.callbacks) await cb();

    const sentLogs = await prisma.notificationLog.findMany({
      where: { bookingId: r.bookingId },
    });
    for (const log of sentLogs) {
      expect(log.status).toBe('sent');
      expect(log.externalRef).toMatch(/^stub_/);
      expect(log.sentAt).not.toBeNull();
    }
  });
});

describe('initiateCashBooking — failure modes', () => {
  it('returns hold_not_found for an unknown holdId', async () => {
    const c = collector();
    const r = await initiateCashBooking({
      holdId: 'nonexistent-hold-id',
      baseUrl: BASE_URL,
      afterFn: c.fn,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('hold_not_found');
    expect(c.callbacks.length).toBe(0);
  });

  it('returns hold_expired when hold has passed expiresAt', async () => {
    const holdId = await activeHold(1);
    await prisma.hold.update({
      where: { id: holdId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const c = collector();
    const r = await initiateCashBooking({ holdId, baseUrl: BASE_URL, afterFn: c.fn });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('hold_expired');
    expect(c.callbacks.length).toBe(0);

    // No booking, no notifications
    const bookings = await prisma.booking.findMany({ where: { holdId } });
    expect(bookings.length).toBe(0);
  });

  it('returns trip_departed when trip departureAt is in the past', async () => {
    const holdId = await activeHold(1);
    // Force-depart the trip (hold itself still active+unexpired)
    await prisma.trip.update({
      where: { id: tripId },
      data: { departureAt: new Date(Date.now() - 60_000) },
    });
    const c = collector();
    const r = await initiateCashBooking({ holdId, baseUrl: BASE_URL, afterFn: c.fn });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('trip_departed');
    expect(c.callbacks.length).toBe(0);
  });

  it('second call with same holdId is idempotent (recovers existing booking)', async () => {
    const holdId = await activeHold(1);
    const c1 = collector();
    const r1 = await initiateCashBooking({ holdId, baseUrl: BASE_URL, afterFn: c1.fn });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    const c2 = collector();
    const r2 = await initiateCashBooking({ holdId, baseUrl: BASE_URL, afterFn: c2.fn });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.bookingId).toBe(r1.bookingId);
    expect(r2.confirmationToken).toBe(r1.confirmationToken);

    // No duplicate booking, no duplicate notifications
    const bookings = await prisma.booking.findMany({ where: { holdId } });
    expect(bookings.length).toBe(1);
    const logs = await prisma.notificationLog.findMany({ where: { bookingId: r1.bookingId } });
    expect(logs.length).toBe(2);
    // The second call must NOT have queued a new dispatch
    expect(c2.callbacks.length).toBe(0);
  });
});
