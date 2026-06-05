/**
 * Integration tests for the concurrent-hold cap (Issue 098).
 *
 * Requires a real PostgreSQL database. Run with: pnpm vitest:int
 *
 * Tests:
 *  1. Normal single hold is unaffected.
 *  2. N+1 parallel holds from the same phone → cap succeed, 1 throws HoldCapExceededError.
 *  3. Holds from distinct phones are independent (cap not shared).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { createHold, CONCURRENT_HOLD_CAP } from '../holdRepo';
import { HoldCapExceededError } from '../holdErrors';

const PHONE_CAP_TEST = '+8490xxxxxx6';
const PHONE_OTHER = '+8490xxxxxx7';

let operatorId: string;
let busId: string;
let routeId: string;
const tripIds: string[] = [];

beforeAll(async () => {
  const operator = await prisma.operator.create({
    data: {
      legalName: 'HoldCap Test Operator',
      contactPhone: '+8490xxxxxx8',
      contactEmail: 'test@holdcap.test',
      status: 'APPROVED',
    },
  });
  operatorId = operator.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 10, licensePlate: 'TEST-HC-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: { origin: 'Cap Test Origin', destination: 'Cap Test Destination', operatorId, durationMinutes: 120 },
  });
  routeId = route.id;

  // Create CAP+1 trips so we can fire CAP+1 parallel holds
  for (let i = 0; i < CONCURRENT_HOLD_CAP + 1; i++) {
    const trip = await prisma.trip.create({
      data: {
        routeId,
        busId,
        operatorId,
        departureAt: new Date(Date.now() + (24 + i) * 60 * 60 * 1000),
        price: 100000,
        status: 'scheduled',
        salesClosed: false,
      },
    });
    tripIds.push(trip.id);
  }
});

afterEach(async () => {
  await prisma.hold.deleteMany({ where: { tripId: { in: tripIds } } });
});

afterAll(async () => {
  await prisma.hold.deleteMany({ where: { tripId: { in: tripIds } } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('concurrent-hold cap (Issue 098)', () => {
  it('single hold is unaffected — normal checkout path works', async () => {
    const result = await createHold({
      tripId: tripIds[0],
      ticketCount: 1,
      customerPhone: PHONE_CAP_TEST,
      customerName: 'Cap Test User',
    });

    expect(result).not.toBeNull();
    expect(result!.holdId).toBeDefined();
  });

  it(`N=${CONCURRENT_HOLD_CAP + 1} parallel holds from one phone → ${CONCURRENT_HOLD_CAP} succeed, 1 throws HoldCapExceededError`, async () => {
    const results = await Promise.allSettled(
      tripIds.map((tripId) =>
        createHold({
          tripId,
          ticketCount: 1,
          customerPhone: PHONE_CAP_TEST,
          customerName: 'Cap Test User',
        })
      )
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const capErrors = results.filter(
      (r) => r.status === 'rejected' && r.reason instanceof HoldCapExceededError
    );
    const otherErrors = results.filter(
      (r) => r.status === 'rejected' && !(r.reason instanceof HoldCapExceededError)
    );

    expect(otherErrors.length).toBe(0); // no unexpected errors
    expect(fulfilled.length).toBe(CONCURRENT_HOLD_CAP);
    expect(capErrors.length).toBe(1);
  });

  it('holds from distinct phones are independent — cap not shared between phones', async () => {
    // First phone creates CAP holds (filling its own cap)
    for (let i = 0; i < CONCURRENT_HOLD_CAP; i++) {
      const r = await createHold({
        tripId: tripIds[i],
        ticketCount: 1,
        customerPhone: PHONE_CAP_TEST,
        customerName: 'Phone A',
      });
      expect(r).not.toBeNull();
    }

    // Second phone on the same trip bucket should still be allowed (different phone, different cap)
    // Use the last trip (index CAP) which has no holds yet
    const otherResult = await createHold({
      tripId: tripIds[CONCURRENT_HOLD_CAP],
      ticketCount: 1,
      customerPhone: PHONE_OTHER,
      customerName: 'Phone B',
    });
    expect(otherResult).not.toBeNull();
  });
});
