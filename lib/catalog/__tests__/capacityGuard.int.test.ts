/**
 * Integration tests for getTripOccupancy() — supplies the snapshot consumed by
 * canReduceCapacity() (pure-lib, already tested in capacityGuard.test.ts).
 *
 * AC3: occupancy = activeHolds + paidBookings on future trips only.
 *      - past trips (departureAt < now) are excluded
 *      - expired/cancelled holds excluded
 *      - cancelled/expired bookings excluded
 *
 * Also contains transactional guard tests (Gap 3 — Issue 011 Iter-2):
 *   Verifies that the $transaction + FOR UPDATE path still satisfies the
 *   happy-path and violating-trips contract under transactional shape.
 *
 * Run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { randomUUID } from 'crypto';
import { getTripOccupancy } from '../getTripOccupancy';
import { canReduceCapacity } from '../capacityGuard';

let operatorId: string;
let busId: string;
let routeId: string;
let pastTripId: string;
let futureTripA: string;
let futureTripB: string;

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: { legalName: 'Cap Test Op', contactPhone: '+8490xxxxxx5', contactEmail: 'cap@cap.test' },
  });
  operatorId = op.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 40, licensePlate: 'CAP-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: { origin: 'Cap Origin', destination: 'Cap Destination', operatorId, durationMinutes: 240 },
  });
  routeId = route.id;

  const past = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: new Date(Date.now() - 86_400_000),
      price: 100_000,
      status: 'completed',
    },
  });
  pastTripId = past.id;

  const futA = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: new Date(Date.now() + 86_400_000),
      price: 100_000,
      status: 'scheduled',
    },
  });
  futureTripA = futA.id;

  const futB = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: new Date(Date.now() + 2 * 86_400_000),
      price: 100_000,
      status: 'scheduled',
    },
  });
  futureTripB = futB.id;

  // Past trip: should NEVER appear in occupancy
  await prisma.hold.create({
    data: {
      tripId: pastTripId,
      ticketCount: 99,
      customerPhone: '+849011111111',
      customerName: 'past hold',
      expiresAt: new Date(Date.now() + 600_000),
      status: 'active',
    },
  });

  // Future trip A: 3 active holds + 5 paid booking seats
  await prisma.hold.create({
    data: {
      tripId: futureTripA,
      ticketCount: 3,
      customerPhone: '+849011111111',
      customerName: 'A hold',
      expiresAt: new Date(Date.now() + 600_000),
      status: 'active',
    },
  });
  // Expired hold on A — must be excluded
  await prisma.hold.create({
    data: {
      tripId: futureTripA,
      ticketCount: 7,
      customerPhone: '+849011111111',
      customerName: 'expired hold',
      expiresAt: new Date(Date.now() - 600_000),
      status: 'expired',
    },
  });

  await prisma.booking.create({
    data: {
      id: randomUUID(),
      bookingRef: 'BB-CAP-A-aaaa-bbbb',
      confirmationToken: 'tok-cap-a-' + randomUUID(),
      tripId: futureTripA,
      buyerName: 'Paid A',
      buyerPhone: '+849011111111',
      ticketCount: 5,
      totalVnd: 500_000,
      paymentMethod: 'momo',
      status: 'paid',
    },
  });
  // Cancelled booking on A — must be excluded
  await prisma.booking.create({
    data: {
      id: randomUUID(),
      bookingRef: 'BB-CAP-A-cccc-dddd',
      confirmationToken: 'tok-cap-a-cnc-' + randomUUID(),
      tripId: futureTripA,
      buyerName: 'Cancelled A',
      buyerPhone: '+849011111111',
      ticketCount: 4,
      totalVnd: 400_000,
      paymentMethod: 'momo',
      status: 'cancelled',
    },
  });

  // Future trip B: 0 holds, 2 paid booking seats
  await prisma.booking.create({
    data: {
      id: randomUUID(),
      bookingRef: 'BB-CAP-B-eeee-ffff',
      confirmationToken: 'tok-cap-b-' + randomUUID(),
      tripId: futureTripB,
      buyerName: 'Paid B',
      buyerPhone: '+849011111111',
      ticketCount: 2,
      totalVnd: 200_000,
      paymentMethod: 'momo',
      status: 'paid',
    },
  });
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { tripId: { in: [pastTripId, futureTripA, futureTripB] } } });
  await prisma.hold.deleteMany({ where: { tripId: { in: [pastTripId, futureTripA, futureTripB] } } });
  await prisma.trip.deleteMany({ where: { busId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.delete({ where: { id: busId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('getTripOccupancy', () => {
  it('excludes past trips', async () => {
    const result = await getTripOccupancy(busId);
    const tripIds = result.map((t) => t.tripId);
    expect(tripIds).not.toContain(pastTripId);
  });

  it('aggregates active holds + paid bookings only for future trips', async () => {
    const result = await getTripOccupancy(busId);
    expect(result.length).toBe(2);

    const a = result.find((t) => t.tripId === futureTripA);
    const b = result.find((t) => t.tripId === futureTripB);

    expect(a).toBeDefined();
    expect(a!.heldSeats).toBe(3);
    expect(a!.bookedSeats).toBe(5);

    expect(b).toBeDefined();
    expect(b!.heldSeats).toBe(0);
    expect(b!.bookedSeats).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Gap 3 — transactional capacity-guard shape (Issue 011 Iter-2)
//
// Verifies that the FOR UPDATE + occupancy-read + canReduceCapacity logic
// works correctly under the real $transaction callback when executed against
// the live DB.  Tests use the same seed data as the getTripOccupancy suite
// above (futureTripA=8 seats, futureTripB=2 seats).
// ---------------------------------------------------------------------------

describe('transactional capacity-guard (Gap 3)', () => {
  it('happy path: allows capacity reduction to exactly max occupancy (8 seats)', async () => {
    // futureTripA occupancy = 3 held + 5 booked = 8; futureTripB = 2.
    // Reducing to 8 should pass.
    await expect(
      prisma.$transaction(async (tx) => {
        // Simulate FOR UPDATE lock
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Bus" WHERE id = ${busId} FOR UPDATE
        `;
        expect(locked.length).toBe(1);

        const now = new Date();
        const trips = await tx.trip.findMany({
          where: { busId, departureAt: { gt: now } },
          select: {
            id: true,
            holds: {
              where: { status: 'active', expiresAt: { gt: now } },
              select: { ticketCount: true },
            },
            bookings: {
              where: { status: { in: ['paid', 'completed'] } },
              select: { ticketCount: true },
            },
          },
        });
        const occupancy = trips.map((t) => ({
          tripId: t.id,
          heldSeats: t.holds.reduce((s, h) => s + h.ticketCount, 0),
          bookedSeats: t.bookings.reduce((s, b) => s + b.ticketCount, 0),
        }));
        const guard = canReduceCapacity(8, occupancy);
        // 8 == max occupancy across trips, so guard passes
        expect(guard.ok).toBe(true);
        return guard;
      })
    ).resolves.toEqual({ ok: true });
  });

  it('violating path: blocks capacity reduction below max occupancy', async () => {
    // futureTripA occupancy = 8; reducing to 7 must fail.
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Bus" WHERE id = ${busId} FOR UPDATE
        `;

        const now = new Date();
        const trips = await tx.trip.findMany({
          where: { busId, departureAt: { gt: now } },
          select: {
            id: true,
            holds: {
              where: { status: 'active', expiresAt: { gt: now } },
              select: { ticketCount: true },
            },
            bookings: {
              where: { status: { in: ['paid', 'completed'] } },
              select: { ticketCount: true },
            },
          },
        });
        const occupancy = trips.map((t) => ({
          tripId: t.id,
          heldSeats: t.holds.reduce((s, h) => s + h.ticketCount, 0),
          bookedSeats: t.bookings.reduce((s, b) => s + b.ticketCount, 0),
        }));
        const guard = canReduceCapacity(7, occupancy);
        expect(guard.ok).toBe(false);
        if (!guard.ok) {
          expect(guard.violatingTrips.some((v) => v.tripId === futureTripA)).toBe(true);
        }
        return guard;
      })
    ).resolves.toMatchObject({ ok: false });
  });
});
