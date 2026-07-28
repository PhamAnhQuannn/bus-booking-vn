/**
 * Integration tests for holdRepo.createHold().
 *
 * Requires a real PostgreSQL database with the schema applied.
 * Run with: pnpm vitest:int
 *
 * Tests:
 *  1. Single insert succeeds when seats are available.
 *  2. 20 parallel inserts on a capacity-1 trip → exactly one hold exists afterwards.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { createHold } from '../holdRepo';
import { SeatMapBusyError, RequestInFlightError } from '../holdErrors';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

let operatorId: string;
let busId1: string;       // capacity 10
let busId_cap1: string;   // capacity 1 — used for the race test
let routeId: string;
let tripId_ample: string; // trip on bus with capacity 10
let tripId_one: string;   // trip on bus with capacity 1

beforeAll(async () => {
  // Create minimal operator / bus / route / trip fixtures
  const operator = await prisma.operator.create({
    data: {
      legalName: 'HoldRepo Test Operator',
      contactPhone: '+8490xxxxxx9',
      contactEmail: 'test@holdrepo.test',
    },
  });
  operatorId = operator.id;

  const bus1 = await prisma.bus.create({
    data: { operatorId, capacity: 10, licensePlate: 'TEST-HR-001', busType: 'coach' },
  });
  busId1 = bus1.id;

  const bus2 = await prisma.bus.create({
    data: { operatorId, capacity: 1, licensePlate: 'TEST-HR-002', busType: 'coach' },
  });
  busId_cap1 = bus2.id;

  const route = await prisma.route.create({
    data: { origin: 'Hold Test Origin', destination: 'Hold Test Destination', operatorId, durationMinutes: 240 },
  });
  routeId = route.id;

  const trip1 = await prisma.trip.create({
    data: {
      routeId,
      busId: busId1,
      operatorId,
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      price: 100000,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  tripId_ample = trip1.id;

  const trip2 = await prisma.trip.create({
    data: {
      routeId,
      busId: busId_cap1,
      operatorId,
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      price: 100000,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  tripId_one = trip2.id;
});

afterEach(async () => {
  // Clean up holds between tests to avoid state leakage
  await prisma.hold.deleteMany({ where: { tripId: { in: [tripId_ample, tripId_one] } } });
});

afterAll(async () => {
  // Tear down all fixtures
  await prisma.hold.deleteMany({ where: { tripId: { in: [tripId_ample, tripId_one] } } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createHold', () => {
  it('returns holdId and expiresAt when seats are available', async () => {
    const result = await createHold({
      tripId: tripId_ample,
      ticketCount: 1,
      customerPhone: '0912345678',
      customerName: 'Test User One',
    });

    expect(result).not.toBeNull();
    expect(typeof result!.holdId).toBe('string');
    expect(result!.holdId.length).toBeGreaterThan(0);
    expect(result!.expiresAt).toBeInstanceOf(Date);
    expect(result!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns null when trip does not exist', async () => {
    const result = await createHold({
      tripId: 'nonexistent-trip-id',
      ticketCount: 1,
      customerPhone: '0912345678',
      customerName: 'Test User',
    });
    expect(result).toBeNull();
  });

  it('returns null when ticketCount exceeds capacity', async () => {
    // busId_cap1 has capacity=1, but request is for 5
    const result = await createHold({
      tripId: tripId_one,
      ticketCount: 5,
      customerPhone: '0912345678',
      customerName: 'Test User',
    });
    expect(result).toBeNull();
  });

  it('20 parallel inserts on capacity-1 trip → exactly 1 succeeds', async () => {
    // DISTINCT phones, deliberately. This test's subject is the CAPACITY guard, and the
    // shared phone number it used to pass was incidental — worse, it meant every caller
    // queued on the per-phone lock, so most never reached the capacity check at all. Once
    // that lock became a try-lock (#362) the shared phone made 19 callers bail on
    // self-contention instead, which is a truthful outcome but tests nothing about
    // capacity. Distinct phones put the contention where the guard actually lives.
    const N = 20;
    const results = await Promise.allSettled(
      Array.from({ length: N }, (_, i) =>
        createHold({
          tripId: tripId_one,
          ticketCount: 1,
          customerPhone: `09123456${String(i).padStart(2, '0')}`,
          customerName: `Parallel User ${i + 1}`,
        })
      )
    );

    const successes = results.filter((r) => r.status === 'fulfilled' && r.value !== null);
    expect(successes.length).toBe(1);

    // Everything else must be either a clean sold-out (null) or a contention decline.
    // Nothing may fail for any OTHER reason — that is what would hide a real bug.
    const unexpected = results.filter(
      (r) =>
        r.status === 'rejected' &&
        !(r.reason instanceof SeatMapBusyError) &&
        !(r.reason instanceof RequestInFlightError)
    );
    expect(
      unexpected.map((r) => (r as PromiseRejectedResult).reason?.message ?? 'unknown')
    ).toEqual([]);

    // THE safety property, and the reason the assertion above is not enough: "exactly one
    // caller got a truthy result" is a consistency property about return values. What
    // actually must hold is that the capacity-1 trip carries exactly ONE active hold row —
    // which is what an oversell would violate (2026-07-23 mistake-log entry).
    const rows = await prisma.hold.findMany({
      where: { tripId: tripId_one, status: 'active' },
      select: { id: true, ticketCount: true },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].ticketCount).toBe(1);
    expect(rows[0].id).toBe((successes[0] as PromiseFulfilledResult<{ holdId: string }>).value.holdId);
  });
});
