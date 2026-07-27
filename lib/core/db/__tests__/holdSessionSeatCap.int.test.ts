/**
 * Integration tests for the per-session SEAT cap (#359).
 *
 * Requires a real PostgreSQL database. Run with: pnpm vitest:int
 *
 * Why a real DB and not a mocked tx: the cap is a SUM taken inside a
 * pg_advisory_xact_lock, so its whole correctness claim is about concurrent
 * transactions. A hand-rolled tx mock cannot reproduce lock serialisation and would
 * pass against a broken implementation — the same class as the P2002-in-tx and
 * NotificationLog-unique entries in the mistake log.
 *
 * The attack this closes: the phone cap counts HOLDS, not SEATS. ticketCount is capped
 * at 10 per hold and CONCURRENT_HOLD_CAP is 5, so one unverified phone could hold 50
 * seats in five requests — a whole 45-seat trip, nowhere near the 60/min IP limit.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { createHold, SESSION_SEAT_CAP } from '../holdRepo';
import { SessionSeatCapExceededError } from '../holdErrors';

const SESSION_A = 'sess-aaaaaaaaaaaaaaaaaaaa';
const SESSION_B = 'sess-bbbbbbbbbbbbbbbbbbbb';

let operatorId: string;
let busId: string;
let routeId: string;
const tripIds: string[] = [];

/** Enough trips that a per-trip capacity limit never masks a session-cap result. */
const TRIP_COUNT = 8;

beforeAll(async () => {
  const operator = await prisma.operator.create({
    data: {
      legalName: 'SeatCap Test Operator',
      contactPhone: '+8490xxxxxx4',
      contactEmail: 'test@seatcap.test',
      status: 'APPROVED',
    },
  });
  operatorId = operator.id;

  // Capacity 45 mirrors the real coach the issue is written against.
  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 45, licensePlate: 'TEST-SC-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: {
      origin: 'SeatCap Origin',
      destination: 'SeatCap Destination',
      operatorId,
      durationMinutes: 120,
    },
  });
  routeId = route.id;

  for (let i = 0; i < TRIP_COUNT; i++) {
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

describe('per-session seat cap (#359)', () => {
  it('a single family hold at the full cap still succeeds', async () => {
    // The legitimate case the per-hold max was sized for. If this breaks, the cap is
    // punishing real customers rather than squatters.
    const result = await createHold({
      tripId: tripIds[0],
      ticketCount: SESSION_SEAT_CAP,
      customerPhone: '+8490xxxxxx1',
      customerName: 'Family Booking',
      sessionId: SESSION_A,
    });

    expect(result).not.toBeNull();
  });

  it('blocks the squat: seats are capped across DIFFERENT phones in one session', async () => {
    // This is the actual attack — rotating the (unverified, attacker-chosen) phone is free,
    // so the phone cap does not bound it. Each hold uses a distinct valid-format phone.
    const first = await createHold({
      tripId: tripIds[0],
      ticketCount: SESSION_SEAT_CAP,
      customerPhone: '+8490xxxxxx1',
      customerName: 'Squatter One',
      sessionId: SESSION_A,
    });
    expect(first).not.toBeNull();

    await expect(
      createHold({
        tripId: tripIds[1],
        ticketCount: 1,
        customerPhone: '+8490xxxxxx2', // different phone, same session
        customerName: 'Squatter Two',
        sessionId: SESSION_A,
      })
    ).rejects.toBeInstanceOf(SessionSeatCapExceededError);
  });

  it('counts SEATS, not holds — many small holds hit the same ceiling', async () => {
    for (let i = 0; i < SESSION_SEAT_CAP; i++) {
      const r = await createHold({
        tripId: tripIds[i % TRIP_COUNT],
        ticketCount: 1,
        customerPhone: `+8490xxxxxx${i % 10}`,
        customerName: `Seat ${i}`,
        sessionId: SESSION_A,
      });
      expect(r).not.toBeNull();
    }

    await expect(
      createHold({
        tripId: tripIds[0],
        ticketCount: 1,
        customerPhone: '+8490xxxxxx9',
        customerName: 'One Too Many',
        sessionId: SESSION_A,
      })
    ).rejects.toBeInstanceOf(SessionSeatCapExceededError);
  });

  it('is race-safe: parallel holds from one session cannot exceed the cap', async () => {
    // The reason the SUM sits inside pg_advisory_xact_lock('hold-session:'||sessionId).
    // Without the lock, N concurrent transactions all read the same pre-insert SUM and all
    // pass the check — the classic read-then-write TOCTOU this repo's mistake log is full of.
    const ATTEMPTS = TRIP_COUNT;
    const SEATS_EACH = 4; // 8 × 4 = 32 requested, cap is 10

    const results = await Promise.allSettled(
      Array.from({ length: ATTEMPTS }, (_, i) =>
        createHold({
          tripId: tripIds[i],
          ticketCount: SEATS_EACH,
          customerPhone: `+8490xxxxxx${i % 10}`,
          customerName: `Parallel ${i}`,
          sessionId: SESSION_A,
        })
      )
    );

    const unexpected = results.filter(
      (r) => r.status === 'rejected' && !(r.reason instanceof SessionSeatCapExceededError)
    );
    expect(unexpected).toHaveLength(0);

    const granted = await prisma.hold.aggregate({
      _sum: { ticketCount: true },
      where: { sessionId: SESSION_A, status: 'active' },
    });
    expect(granted._sum.ticketCount ?? 0).toBeLessThanOrEqual(SESSION_SEAT_CAP);
  });

  it('sessions are independent — one session does not consume another\'s allowance', async () => {
    const a = await createHold({
      tripId: tripIds[0],
      ticketCount: SESSION_SEAT_CAP,
      customerPhone: '+8490xxxxxx1',
      customerName: 'Session A',
      sessionId: SESSION_A,
    });
    expect(a).not.toBeNull();

    const b = await createHold({
      tripId: tripIds[1],
      ticketCount: SESSION_SEAT_CAP,
      customerPhone: '+8490xxxxxx2',
      customerName: 'Session B',
      sessionId: SESSION_B,
    });
    expect(b).not.toBeNull();
  });

  it('a caller with no session is not capped by it (and does not share one bucket)', async () => {
    // Cookie-less callers cannot be attributed to a session. Lumping them together would let
    // one script starve every cookie-less user behind the same CGNAT egress; the route layer
    // rate-limits that population separately (holdsAnonRatelimit) instead.
    const first = await createHold({
      tripId: tripIds[0],
      ticketCount: SESSION_SEAT_CAP,
      customerPhone: '+8490xxxxxx1',
      customerName: 'No Session One',
      sessionId: null,
    });
    expect(first).not.toBeNull();

    const second = await createHold({
      tripId: tripIds[1],
      ticketCount: 1,
      customerPhone: '+8490xxxxxx2',
      customerName: 'No Session Two',
      sessionId: null,
    });
    expect(second).not.toBeNull();
  });
});
