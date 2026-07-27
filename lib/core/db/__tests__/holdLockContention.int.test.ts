/**
 * Bounded-lock contention gate (#362).
 *
 * Requires a real PostgreSQL database. Run with: pnpm vitest:int
 *
 * WHAT THIS PROVES, and why it is written the hard way.
 *
 * createHold used to take the TRIP lock with the BLOCKING pg_advisory_xact_lock, so a
 * waiter for a hot trip pinned its pooled connection for the whole queue wait. At the
 * Neon-correct DATABASE_POOL_MAX=1 that PR #301 introduces, one blocked hold leaves the
 * warm lambda instance with ZERO free connections — a per-instance outage, not slowness.
 *
 * The obvious test — fire N concurrent createHold calls and assert nothing hangs — is
 * VACUOUS, and was written and thrown away before this one. At pool=1 only a single
 * transaction can be in flight per process, so the connection pool serialises the calls
 * before the advisory lock ever gets the chance to. Nothing contends, and the test passes
 * identically against the blocking implementation. Verified, not assumed.
 *
 * Real contention is cross-connection: instance A holds the trip lock while instance B
 * waits. So this test reproduces that shape directly — an INDEPENDENT connection takes
 * the same advisory lock and holds it open, then createHold runs against a lock it cannot
 * get. Blocking implementation: hangs until the holder commits. Try-lock implementation:
 * exhausts its bounded retries and returns a clean SeatMapBusyError in milliseconds.
 *
 * That difference is the whole change, so it is what the gate measures.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { prisma } from '@/lib/core/db/client';
import { createHold } from '../holdRepo';
import { SeatMapBusyError } from '../holdErrors';

let operatorId: string;
let busId: string;
let routeId: string;
let tripId: string;

/** Ample capacity: nobody should be rejected for lack of seats, only for contention. */
const CAPACITY = 45;
/** Concurrent buyers hitting the one hot trip. */
const CONCURRENCY = 12;

beforeAll(async () => {
  const operator = await prisma.operator.create({
    data: {
      legalName: 'LockContention Test Operator',
      contactPhone: '+8490xxxxxx3',
      contactEmail: 'test@lockcontention.test',
      status: 'APPROVED',
    },
  });
  operatorId = operator.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: CAPACITY, licensePlate: 'TEST-LC-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: {
      origin: 'LockContention Origin',
      destination: 'LockContention Destination',
      operatorId,
      durationMinutes: 120,
    },
  });
  routeId = route.id;

  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      price: 100000,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  tripId = trip.id;
});

afterEach(async () => {
  await prisma.hold.deleteMany({ where: { tripId } });
});

afterAll(async () => {
  await prisma.hold.deleteMany({ where: { tripId } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('bounded trip-lock under contention (#362)', () => {
  it('gives up quickly with SeatMapBusyError when another connection holds the trip lock', async () => {
    // THE gate. An independent pg connection takes the same advisory lock and holds it
    // open inside an uncommitted transaction — exactly what a competing lambda instance
    // does. The blocking implementation waits here indefinitely; the try-lock one burns
    // its 3 bounded retries and reports busy.
    const holder = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const held = await holder.connect();

    try {
      await held.query('BEGIN');
      await held.query("SELECT pg_advisory_xact_lock(hashtext('hold:' || $1))", [tripId]);

      const started = Date.now();
      const outcome = await Promise.race([
        createHold({
          tripId,
          ticketCount: 1,
          customerPhone: '+8490xxxxxx1',
          customerName: 'Blocked Buyer',
          sessionId: 'sess-blocked',
        }).then(
          () => 'resolved' as const,
          (err) => (err instanceof SeatMapBusyError ? ('busy' as const) : Promise.reject(err))
        ),
        // Generous vs. the ~120ms of jittered backoff, tight vs. the 10s
        // connectionTimeoutMillis a blocking wait would run into.
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3_000)),
      ]);
      const elapsed = Date.now() - started;

      // 'timeout' here IS the blocking-lock regression: the call never returned because
      // it was queued on the lock rather than declining.
      expect(outcome).toBe('busy');
      expect(elapsed).toBeLessThan(3_000);

      // Nothing was written while the lock was unavailable.
      const during = await prisma.hold.count({ where: { tripId, status: 'active' } });
      expect(during).toBe(0);
    } finally {
      await held.query('ROLLBACK');
      held.release();
      await holder.end();
    }
  });

  it('succeeds normally once the competing lock is released', async () => {
    // Liveness half: the retry path must not leave the trip permanently unbookable.
    const result = await createHold({
      tripId,
      ticketCount: 1,
      customerPhone: '+8490xxxxxx1',
      customerName: 'Unblocked Buyer',
      sessionId: 'sess-unblocked',
    });

    expect(result).not.toBeNull();
  });

  it('resolves every concurrent hold without hanging', async () => {
    const started = Date.now();

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        createHold({
          tripId,
          ticketCount: 1,
          customerPhone: `+8490xxxxxx${i % 10}`,
          customerName: `Contender ${i}`,
          // Distinct sessions: the session lock must not be what serialises this. The
          // trip lock is the one under test.
          sessionId: `sess-contend-${i}`,
        })
      )
    );

    const elapsed = Date.now() - started;

    const unexpected = results.filter(
      (r) => r.status === 'rejected' && !(r.reason instanceof SeatMapBusyError)
    );
    expect(
      unexpected.map((r) => (r as PromiseRejectedResult).reason?.message ?? 'unknown')
    ).toEqual([]);
    expect(elapsed).toBeLessThan(10_000);

    // Correctness is not traded away for liveness: no oversell, no duplicate rows.
    const holds = await prisma.hold.findMany({
      where: { tripId, status: 'active' },
      select: { id: true, ticketCount: true },
    });
    const seats = holds.reduce((sum, h) => sum + h.ticketCount, 0);
    expect(seats).toBeLessThanOrEqual(CAPACITY);
    expect(new Set(holds.map((h) => h.id)).size).toBe(holds.length);

    const granted = results.filter((r) => r.status === 'fulfilled' && r.value !== null);
    expect(granted.length).toBeGreaterThan(0);
  });

  it('still cannot oversell when capacity is the binding constraint', async () => {
    // Guards the other direction: making the lock non-blocking must not weaken the
    // conditional INSERT's serialisation. Ask for far more seats than exist.
    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        createHold({
          tripId,
          ticketCount: 10,
          customerPhone: `+8490xxxxxx${i % 10}`,
          customerName: `Oversell ${i}`,
          sessionId: `sess-oversell-${i}`,
        })
      )
    );

    const unexpected = results.filter(
      (r) => r.status === 'rejected' && !(r.reason instanceof SeatMapBusyError)
    );
    expect(unexpected).toHaveLength(0);

    const agg = await prisma.hold.aggregate({
      _sum: { ticketCount: true },
      where: { tripId, status: 'active' },
    });
    expect(agg._sum.ticketCount ?? 0).toBeLessThanOrEqual(CAPACITY);
  });
});
