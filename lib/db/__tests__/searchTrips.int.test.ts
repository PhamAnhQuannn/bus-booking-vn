/**
 * Integration tests for searchTrips() availability math.
 *
 * Requires a real PostgreSQL database with the schema applied.
 * Run with: pnpm test:integration
 *
 * P1 regression (2026-06-01): searchTrips() must ALWAYS report
 *   availableSeats = capacity - blockedSeats - activeHeldSeats - paid/pendingBookedSeats
 * and never raw capacity. The prior SEARCH_USE_BLOCKED_SEATS flag defaulted false and
 * shipped raw capacity in the default config (oversell). These tests pin the holds-aware
 * + bookings-aware behaviour as the ONLY behaviour.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/client';
import { createHold } from '../holdRepo';
import { searchTrips } from '../searchTrips';

const ORIGIN = 'ZZ SearchTrips Origin';
const DEST = 'ZZ SearchTrips Destination';

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;

// Trip departs in 24h; derive the VN-local (UTC+7) date string the search filters on.
const departureAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
const vnDate = new Date(departureAt.getTime() + 7 * 3600 * 1000)
  .toISOString()
  .slice(0, 10);

beforeAll(async () => {
  const operator = await prisma.operator.create({
    data: {
      legalName: 'SearchTrips Test Operator',
      contactPhone: '+8490xxxxxx3',
      contactEmail: 'test@searchtrips.test',
      notificationPhone: '+8490xxxxxx4',
    },
  });
  operatorId = operator.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 10, licensePlate: 'TEST-ST-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: { origin: ORIGIN, destination: DEST, operatorId, durationMinutes: 240 },
  });
  routeId = route.id;

  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt,
      price: 100000,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  tripId = trip.id;
});

afterEach(async () => {
  await prisma.booking.deleteMany({ where: { tripId } });
  await prisma.hold.deleteMany({ where: { tripId } });
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { tripId } });
  await prisma.hold.deleteMany({ where: { tripId } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

/** Seed a paid booking directly (avoids the soon-deleted cash-booking helpers). */
async function seedPaidBooking(ticketCount: number): Promise<void> {
  await prisma.booking.create({
    data: {
      id: randomUUID(),
      bookingRef: `BB-TST-${randomUUID().slice(0, 4)}-${randomUUID().slice(0, 4)}`,
      confirmationToken: randomUUID().replace(/-/g, '') + randomUUID().slice(0, 4),
      tripId,
      buyerName: 'Paid Buyer',
      buyerPhone: '+8490xxxxxx5',
      ticketCount,
      totalVnd: ticketCount * 100000,
      paymentMethod: 'momo',
      status: 'paid_operator_notified',
    },
  });
}

function search(ticketCount: number) {
  return searchTrips({ origin: ORIGIN, destination: DEST, date: vnDate, ticketCount });
}

describe('searchTrips availability (holds + bookings aware, never raw capacity)', () => {
  it('reports full capacity when there are no holds or bookings', async () => {
    const results = await search(1);
    const row = results.find((r) => r.tripId === tripId);
    expect(row).toBeDefined();
    expect(row?.availableSeats).toBe(10);
  });

  it('subtracts active held seats from availability', async () => {
    const hold = await createHold({
      tripId,
      ticketCount: 3,
      customerPhone: '+8490xxxxxx1',
      customerName: 'Holder',
    });
    expect(hold).not.toBeNull();

    const row = (await search(1)).find((r) => r.tripId === tripId);
    expect(row?.availableSeats).toBe(7);
  });

  it('subtracts paid/pending booked seats from availability', async () => {
    await seedPaidBooking(4);

    const row = (await search(1)).find((r) => r.tripId === tripId);
    expect(row?.availableSeats).toBe(6);
  });

  it('EXCLUDES a trip whose remaining availability is below the requested ticketCount (oversell guard)', async () => {
    // 3 held + 5 paid = 8 taken of 10 → only 2 left.
    const hold = await createHold({
      tripId,
      ticketCount: 3,
      customerPhone: '+8490xxxxxx1',
      customerName: 'Holder',
    });
    expect(hold).not.toBeNull();
    await seedPaidBooking(5);

    // Requesting 3 seats must exclude the trip (raw-capacity logic would have kept it).
    const results = await search(3);
    expect(results.find((r) => r.tripId === tripId)).toBeUndefined();

    // Requesting 2 seats still finds it, reporting the true remaining availability.
    const okRow = (await search(2)).find((r) => r.tripId === tripId);
    expect(okRow?.availableSeats).toBe(2);
  });
});
