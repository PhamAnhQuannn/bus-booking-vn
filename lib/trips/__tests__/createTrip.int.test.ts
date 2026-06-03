/**
 * Integration tests for createTrip() bus double-book guard.
 *
 * Requires a real PostgreSQL database with the schema applied.
 * Run with: pnpm test:integration
 *
 * P1 regression (2026-06-01): createTrip() previously ran with NO overlap guard and
 * NO transaction, so a bus could be double-booked on create — including under a race.
 * The guard locks the bus row (FOR UPDATE) and rejects window-overlapping trips. Only a
 * concurrent-write test exercises the lock (a happy-path test passes even without it).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { createTrip } from '../createTrip';
import { TripServiceError } from '../errors';

const DURATION = 240; // minutes; window = [dep, dep + 240 + 60 buffer]

let operatorId: string;
let routeId: string;
let busId: string;

const baseDeparture = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // a week out

beforeAll(async () => {
  const operator = await prisma.operator.create({
    data: {
      legalName: 'CreateTrip Overlap Operator',
      contactPhone: '+8490xxxxxx3',
      contactEmail: 'test@createtrip.test',
      notificationPhone: '+8490xxxxxx4',
    },
  });
  operatorId = operator.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 30, licensePlate: 'TEST-CT-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: {
      origin: 'CT Overlap Origin',
      destination: 'CT Overlap Destination',
      operatorId,
      durationMinutes: DURATION,
    },
  });
  routeId = route.id;
});

afterEach(async () => {
  await prisma.trip.deleteMany({ where: { routeId } });
});

afterAll(async () => {
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

function create(departureAt: Date) {
  return createTrip({ operatorId, routeId, busId, departureAt, price: 100000 });
}

describe('createTrip bus double-book guard', () => {
  it('rejects a window-overlapping (non-equal) departure — proves window, not equality', async () => {
    await create(baseDeparture);

    // +30 min: well inside the [dep, dep+300min] occupancy window. Exact-equality
    // logic would have allowed this; the window guard must reject it.
    const overlapping = new Date(baseDeparture.getTime() + 30 * 60_000);
    await expect(create(overlapping)).rejects.toMatchObject({ code: 'bus_overlap' });
  });

  it('allows a departure beyond the occupancy window (duration + buffer)', async () => {
    await create(baseDeparture);

    // Just past dep + 240 + 60 buffer = +301 min → no overlap.
    const clear = new Date(baseDeparture.getTime() + 301 * 60_000);
    const dto = await create(clear);
    expect(dto.status).toBe('scheduled');
  });

  it('serializes concurrent creates on the same bus+window → exactly 1 succeeds', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => create(baseDeparture))
    );

    const ok = results.filter((r) => r.status === 'fulfilled');
    const overlap = results.filter(
      (r) =>
        r.status === 'rejected' &&
        r.reason instanceof TripServiceError &&
        r.reason.code === 'bus_overlap'
    );

    expect(ok.length).toBe(1);
    expect(overlap.length).toBe(5);

    // And the DB holds exactly one trip for the route.
    const count = await prisma.trip.count({ where: { routeId } });
    expect(count).toBe(1);
  });
});
