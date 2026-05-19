/**
 * Integration tests for bookingRepo.createCashBookingFromHold() +
 * getBookingByConfirmationToken().
 *
 * Requires a real PostgreSQL database with the schema applied.
 * Run with: pnpm test:integration
 *
 * Tests:
 *  1. Single insert succeeds when hold is active + unexpired.
 *  2. Idempotent: 2 calls with the same holdId → both succeed; second returns
 *     already_booked (race-safe via ON CONFLICT (holdId) DO NOTHING).
 *  3. Hold expired → hold_expired.
 *  4. Hold already converted → hold_expired (treated as ineligible).
 *  5. getBookingByConfirmationToken returns the full payload.
 *  6. getBookingByConfirmationToken returns null for unknown token.
 *  7. 10 parallel inserts with the same holdId → exactly 1 ok, 9 already_booked.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '@/lib/db/client';
import { createHold } from '../holdRepo';
import { createCashBookingFromHold, getBookingByConfirmationToken } from '../bookingRepo';

let operatorId: string;
let routeId: string;
let busId: string;
let busId_cap1: string;
let tripId: string;
let tripId_cap1: string;

beforeAll(async () => {
  const operator = await prisma.operator.create({
    data: {
      legalName: 'BookingRepo Test Operator',
      contactPhone: '+8490xxxxxx3',
      contactEmail: 'test@bookingrepo.test',
      notificationPhone: '+8490xxxxxx4',
    },
  });
  operatorId = operator.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 10, licensePlate: 'TEST-BR-001', busType: 'coach' },
  });
  busId = bus.id;

  const bus1 = await prisma.bus.create({
    data: { operatorId, capacity: 1, licensePlate: 'TEST-BR-002', busType: 'coach' },
  });
  busId_cap1 = bus1.id;

  const route = await prisma.route.create({
    data: { origin: 'BR Test Origin', destination: 'BR Test Destination', operatorId, durationMinutes: 240 },
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

  const trip1 = await prisma.trip.create({
    data: {
      routeId,
      busId: busId_cap1,
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      price: 100000,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  tripId_cap1 = trip1.id;
});

afterEach(async () => {
  await prisma.notificationLog.deleteMany({});
  await prisma.booking.deleteMany({ where: { tripId: { in: [tripId, tripId_cap1] } } });
  await prisma.hold.deleteMany({ where: { tripId: { in: [tripId, tripId_cap1] } } });
});

afterAll(async () => {
  await prisma.notificationLog.deleteMany({});
  await prisma.booking.deleteMany({ where: { tripId: { in: [tripId, tripId_cap1] } } });
  await prisma.hold.deleteMany({ where: { tripId: { in: [tripId, tripId_cap1] } } });
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

describe('createCashBookingFromHold', () => {
  it('succeeds when hold is active and unexpired', async () => {
    const holdId = await activeHold(2);
    const r = await createCashBookingFromHold({
      holdId,
      buyerName: 'Buyer A',
      buyerPhone: '+8490xxxxxx5',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.booking.tripId).toBe(tripId);
    expect(r.booking.holdId).toBe(holdId);
    expect(r.booking.ticketCount).toBe(2);
    expect(r.booking.totalVnd).toBe(200000);
    expect(r.booking.status).toBe('pending_cash_payment');
    expect(r.booking.paymentMethod).toBe('cash');
    expect(r.booking.bookingRef).toMatch(/^BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}$/);
    expect(r.booking.confirmationToken).toMatch(/^[A-Za-z0-9_-]{32}$/);

    // Hold should be flipped to converted
    const hold = await prisma.hold.findUnique({ where: { id: holdId } });
    expect(hold?.status).toBe('converted');
  });

  it('second call with same holdId returns already_booked (idempotent)', async () => {
    const holdId = await activeHold(1);
    const r1 = await createCashBookingFromHold({
      holdId,
      buyerName: 'Buyer B',
      buyerPhone: '+8490xxxxxx5',
    });
    expect(r1.ok).toBe(true);

    const r2 = await createCashBookingFromHold({
      holdId,
      buyerName: 'Buyer B',
      buyerPhone: '+8490xxxxxx5',
    });
    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.reason).toBe('already_booked');

    const bookings = await prisma.booking.findMany({ where: { holdId } });
    expect(bookings.length).toBe(1);
  });

  it('returns hold_expired when hold is past expiry', async () => {
    const holdId = await activeHold(1);
    // Force-expire the hold
    await prisma.hold.update({
      where: { id: holdId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const r = await createCashBookingFromHold({
      holdId,
      buyerName: 'Buyer C',
      buyerPhone: '+8490xxxxxx5',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('hold_expired');
  });

  it('returns hold_expired when hold is already converted', async () => {
    const holdId = await activeHold(1);
    await prisma.hold.update({
      where: { id: holdId },
      data: { status: 'converted' },
    });
    const r = await createCashBookingFromHold({
      holdId,
      buyerName: 'Buyer D',
      buyerPhone: '+8490xxxxxx5',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('hold_expired');
  });

  it('10 parallel inserts with same holdId → exactly 1 ok, 9 already_booked', async () => {
    const holdId = await activeHold(1);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        createCashBookingFromHold({
          holdId,
          buyerName: 'Race Buyer',
          buyerPhone: '+8490xxxxxx5',
        })
      )
    );
    const okCount = results.filter((r) => r.ok).length;
    const dupCount = results.filter((r) => !r.ok && r.reason === 'already_booked').length;
    expect(okCount).toBe(1);
    expect(dupCount).toBe(9);

    const bookings = await prisma.booking.findMany({ where: { holdId } });
    expect(bookings.length).toBe(1);
  });
});

describe('capacity correctness — bookings subtract from holdRepo availability', () => {
  it('after a hold→booking, a new hold on same cap-1 trip is refused', async () => {
    // Step 1: place hold + convert to booking on the capacity-1 trip
    const firstHold = await createHold({
      tripId: tripId_cap1,
      ticketCount: 1,
      customerPhone: '+8490xxxxxx1',
      customerName: 'First',
    });
    expect(firstHold).not.toBeNull();
    const r = await createCashBookingFromHold({
      holdId: firstHold!.holdId,
      buyerName: 'Buyer',
      buyerPhone: '+8490xxxxxx5',
    });
    expect(r.ok).toBe(true);

    // Step 2: try to place a new hold — should fail because the booking
    // (status=pending_cash_payment) now occupies the seat.
    const secondHold = await createHold({
      tripId: tripId_cap1,
      ticketCount: 1,
      customerPhone: '+8490xxxxxx2',
      customerName: 'Second',
    });
    expect(secondHold).toBeNull();
  });
});

describe('getBookingByConfirmationToken', () => {
  it('returns the booking with full trip/route/operator details', async () => {
    const holdId = await activeHold(1);
    const r = await createCashBookingFromHold({
      holdId,
      buyerName: 'Buyer E',
      buyerPhone: '+8490xxxxxx5',
    });
    if (!r.ok) throw new Error('setup failed');

    const fetched = await getBookingByConfirmationToken(r.booking.confirmationToken);
    expect(fetched).not.toBeNull();
    expect(fetched?.bookingRef).toBe(r.booking.bookingRef);
    expect(fetched?.trip.route.origin).toBe('BR Test Origin');
    expect(fetched?.trip.route.destination).toBe('BR Test Destination');
    expect(fetched?.trip.bus.operator.legalName).toBe('BookingRepo Test Operator');
    expect(fetched?.trip.bus.licensePlate).toBe('TEST-BR-001');
  });

  it('returns null for an unknown token', async () => {
    const fetched = await getBookingByConfirmationToken(
      'a'.repeat(32)
    );
    expect(fetched).toBeNull();
  });
});
