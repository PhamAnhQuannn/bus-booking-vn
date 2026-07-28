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
import { SeatMapBusyError, RequestInFlightError } from '../holdErrors';

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

    // Both contention types are expected here: the phone fixture reuses `i % 10`, so at
    // CONCURRENCY > 10 two callers share a phone and contend on THAT lock rather than the
    // trip's. Accepting only SeatMapBusyError would make this flake exactly when the
    // collision happens.
    const unexpected = results.filter(
      (r) =>
        r.status === 'rejected' &&
        !(r.reason instanceof SeatMapBusyError) &&
        !(r.reason instanceof RequestInFlightError)
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

    // Both contention types are expected here: the phone fixture reuses `i % 10`, so at
    // CONCURRENCY > 10 two callers share a phone and contend on THAT lock rather than the
    // trip's. Accepting only SeatMapBusyError would make this flake exactly when the
    // collision happens.
    const unexpected = results.filter(
      (r) =>
        r.status === 'rejected' &&
        !(r.reason instanceof SeatMapBusyError) &&
        !(r.reason instanceof RequestInFlightError)
    );
    expect(unexpected).toHaveLength(0);

    const agg = await prisma.hold.aggregate({
      _sum: { ticketCount: true },
      where: { tripId, status: 'active' },
    });
    expect(agg._sum.ticketCount ?? 0).toBeLessThanOrEqual(CAPACITY);
  });
});

/**
 * The other two locks, which an earlier draft left BLOCKING on the reasoning that they
 * are per-caller so contention means a double-click.
 *
 * Phase 1 has no customer auth: `customerPhone` is entirely attacker-chosen and `bb_sid`
 * is an unsigned cookie the client can mint, so neither is per-caller in any enforceable
 * sense — and no hold rate limiter is keyed on phone. Advisory locks are GLOBAL while the
 * connection pool is PER-INSTANCE, so concurrent holds sharing one phone (or one forged
 * sid) reproduce the trip lock's exact failure: each instance blocks its only connection
 * (DATABASE_POOL_MAX=1) waiting on a lock another instance holds.
 *
 * Same cross-connection shape as the trip gate above, for the same reason: firing N
 * concurrent calls in-process is vacuous at pool=1, because the pool serialises them
 * before any lock is reached.
 *
 * These fail against a blocking implementation — 'timeout' instead of 'busy'.
 *
 * They also pin the ERROR TYPE, which is not incidental. Session/phone contention is the
 * caller contending with THEMSELVES (double-click, second tab), so it raises
 * RequestInFlightError, not SeatMapBusyError — whose user-facing copy says "many people
 * are booking this trip right now". For a solo double-clicker that is simply false, and
 * it is the same class of lie the cap-vs-busy split already exists to prevent. Asserting
 * `instanceof RequestInFlightError` is what stops a future edit collapsing them again.
 */
describe.each([
  {
    lock: 'phone',
    key: 'hold-phone:',
    keyValue: '+8490xxxxxx7',
    args: { customerPhone: '+8490xxxxxx7', sessionId: 'sess-phone-gate' },
  },
  {
    lock: 'session',
    key: 'hold-session:',
    keyValue: 'sess-contended-gate',
    args: { customerPhone: '+8490xxxxxx6', sessionId: 'sess-contended-gate' },
  },
])('bounded $lock-lock under contention', ({ key, keyValue, args }) => {
  it('declines with SeatMapBusyError instead of pinning the connection', async () => {
    const holder = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const held = await holder.connect();

    try {
      await held.query('BEGIN');
      await held.query(`SELECT pg_advisory_xact_lock(hashtext('${key}' || $1))`, [keyValue]);

      const started = Date.now();
      const outcome = await Promise.race([
        createHold({
          tripId,
          ticketCount: 1,
          customerName: 'Contended Buyer',
          ...args,
        }).then(
          () => 'resolved' as const,
          (err) =>
            // NOT SeatMapBusyError: see the header — the copy for that error would be a
            // false statement about other buyers.
            err instanceof RequestInFlightError
              ? ('busy' as const)
              : Promise.reject(err)
        ),
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3_000)),
      ]);
      const elapsed = Date.now() - started;

      // 'timeout' IS the regression: the call was queued on the lock rather than declining,
      // holding a pooled connection for the whole wait.
      expect(outcome).toBe('busy');
      expect(elapsed).toBeLessThan(3_000);
    } finally {
      await held.query('ROLLBACK');
      held.release();
      await holder.end();
    }
  });
});
