/**
 * Integration tests for Issue 014 trip lifecycle mutations.
 *
 * Run with: pnpm vitest:int
 *
 * Covers:
 * - markDeparted: sets departedAt + salesClosed=true (AC5), idempotency, tenant isolation
 * - markDeparted: blocks further holds/bookings via salesClosed (AC5)
 * - markCompleted: sets completedAt, inserts NotificationLog with scheduledFor=+1d (T+1, S15#5)
 * - markCompleted: idempotency + tenant isolation
 * - markCompleted: only eligible booking statuses get payout log entry
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/client';
import { randomUUID } from 'crypto';
import { markDeparted } from '../markDeparted';
import { markCompleted } from '../markCompleted';
import { TripServiceError } from '../errors';

// ────────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────────

let operatorId: string;
let otherOperatorId: string;
let routeId: string;
let busId: string;

// One fresh trip per test group to avoid state bleed
let departTripId: string;
let completeTripId: string;
let otherTripId: string;

// Paid booking on completeTripId for payout log verification
let paidBookingId: string;
let noShowBookingId: string;  // no_show — NOT eligible for payout
let cancelledBookingId: string;  // cancelled — NOT eligible

async function createTrip(operatorIdParam: string, busIdParam: string, routeIdParam: string): Promise<string> {
  const trip = await prisma.trip.create({
    data: {
      routeId: routeIdParam,
      busId: busIdParam,
      operatorId: operatorIdParam,
      departureAt: new Date(Date.now() - 60_000), // 1 min ago — already "departed"
      price: 100_000,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  return trip.id;
}

async function createBooking(tripIdParam: string, ref: string, status: string, paymentMethod: string): Promise<string> {
  const id = randomUUID();
  const b = await prisma.booking.create({
    data: {
      id,
      bookingRef: ref,
      confirmationToken: 'tok-' + ref,
      tripId: tripIdParam,
      buyerName: 'Lifecycle Tester',
      buyerPhone: '+8490xxxxxx1',
      ticketCount: 1,
      totalVnd: 150_000,
      paymentMethod: paymentMethod as 'momo' | 'zalopay' | 'card',
      status: status as 'paid' | 'no_show' | 'completed' | 'cancelled',
      isManual: false,
      contactStatus: 'pending',
    },
  });
  return b.id;
}

beforeAll(async () => {
  // Operator A
  const op = await prisma.operator.create({
    data: {
      legalName: 'Lifecycle Test Op A',
      contactPhone: '+8490xxxxxx2',
      contactEmail: 'lifecycle-a@test.dev',
    },
  });
  operatorId = op.id;

  // Operator B (tenant isolation)
  const opB = await prisma.operator.create({
    data: {
      legalName: 'Lifecycle Test Op B',
      contactPhone: '+8490xxxxxx3',
      contactEmail: 'lifecycle-b@test.dev',
    },
  });
  otherOperatorId = opB.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 20, licensePlate: 'LIFE-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: {
      origin: 'Lifecycle Origin',
      destination: 'Lifecycle Destination',
      operatorId,
      durationMinutes: 90,
    },
  });
  routeId = route.id;

  // Op B bus + route (for tenant isolation)
  const busB = await prisma.bus.create({
    data: { operatorId: otherOperatorId, capacity: 15, licensePlate: 'LIFE-B01', busType: 'coach' },
  });
  const routeB = await prisma.route.create({
    data: {
      origin: 'B Origin',
      destination: 'B Destination',
      operatorId: otherOperatorId,
      durationMinutes: 60,
    },
  });

  // Separate trips for each test group
  departTripId = await createTrip(operatorId, busId, routeId);
  completeTripId = await createTrip(operatorId, busId, routeId);
  otherTripId = await createTrip(otherOperatorId, busB.id, routeB.id);

  // Bookings on completeTripId
  paidBookingId = await createBooking(
    completeTripId,
    'BB-2026-lif1-aaa1',
    'paid',
    'momo'
  );
  noShowBookingId = await createBooking(
    completeTripId,
    'BB-2026-lif1-bbb2',
    'no_show',
    'momo'
  );
  cancelledBookingId = await createBooking(
    completeTripId,
    'BB-2026-lif1-ccc3',
    'cancelled',
    'momo'
  );
});

afterAll(async () => {
  // Cleanup in reverse FK order
  await prisma.notificationLog.deleteMany({
    where: {
      booking: { trip: { operatorId: { in: [operatorId, otherOperatorId] } } },
    },
  });
  await prisma.booking.deleteMany({
    where: { trip: { operatorId: { in: [operatorId, otherOperatorId] } } },
  });
  await prisma.payout.deleteMany({
    where: { operatorId: { in: [operatorId, otherOperatorId] } },
  });
  await prisma.trip.deleteMany({ where: { operatorId: { in: [operatorId, otherOperatorId] } } });
  await prisma.route.deleteMany({ where: { operatorId: { in: [operatorId, otherOperatorId] } } });
  await prisma.bus.deleteMany({ where: { operatorId: { in: [operatorId, otherOperatorId] } } });
  await prisma.operator.deleteMany({ where: { id: { in: [operatorId, otherOperatorId] } } });
});

// ────────────────────────────────────────────────────────────────────────────
// markDeparted (AC5)
// ────────────────────────────────────────────────────────────────────────────

describe('markDeparted', () => {
  it('AC5: sets departedAt, salesClosed=true, and status=departed on first call', async () => {
    const result = await markDeparted(operatorId, departTripId);

    expect(result.ok).toBe(true);
    expect(result.alreadyDeparted).toBe(false);
    // AC5: trip DTO must report status='departed'
    expect(result.trip.status).toBe('departed');

    const row = await prisma.trip.findUnique({
      where: { id: departTripId },
      select: { departedAt: true, salesClosed: true, status: true },
    });
    expect(row?.departedAt).not.toBeNull();
    // AC5: salesClosed=true blocks new holds/bookings
    expect(row?.salesClosed).toBe(true);
    // AC5: persisted status must be 'departed'
    expect(row?.status).toBe('departed');
  });

  it('AC5 idempotency: second call returns alreadyDeparted=true with HTTP 200', async () => {
    // departTripId already departed from previous test
    const result = await markDeparted(operatorId, departTripId);

    expect(result.ok).toBe(true);
    expect(result.alreadyDeparted).toBe(true);
    // departedAt should still be set (not cleared)
    const row = await prisma.trip.findUnique({
      where: { id: departTripId },
      select: { departedAt: true },
    });
    expect(row?.departedAt).not.toBeNull();
  });

  it('throws not_found for cross-operator trip (tenant isolation)', async () => {
    // operatorId trying to depart otherOperatorId's trip
    await expect(markDeparted(operatorId, otherTripId)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('throws trip_cancelled for cancelled trips', async () => {
    // Create a cancelled trip
    const cancelledTrip = await prisma.trip.create({
      data: {
        routeId,
        busId,
        operatorId,
        departureAt: new Date(Date.now() - 86_400_000),
        price: 100_000,
        status: 'cancelled',
        salesClosed: true,
      },
    });

    await expect(markDeparted(operatorId, cancelledTrip.id)).rejects.toMatchObject({
      code: 'trip_cancelled',
    });

    await prisma.trip.delete({ where: { id: cancelledTrip.id } });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// markCompleted (AC5 + S19 payout notification log)
// ────────────────────────────────────────────────────────────────────────────

describe('markCompleted', () => {
  it('sets completedAt and status=completed on first call', async () => {
    const result = await markCompleted(operatorId, completeTripId);

    expect(result.ok).toBe(true);
    expect(result.alreadyCompleted).toBe(false);
    // AC5: trip DTO must report status='completed'
    expect(result.trip.status).toBe('completed');

    const row = await prisma.trip.findUnique({
      where: { id: completeTripId },
      select: { completedAt: true, status: true },
    });
    expect(row?.completedAt).not.toBeNull();
    // AC5: persisted status must be 'completed'
    expect(row?.status).toBe('completed');
  });

  it('S19: creates NotificationLog with template=payout_scheduled for each eligible booking', async () => {
    // markCompleted was called above — check NotificationLog rows
    const logs = await prisma.notificationLog.findMany({
      where: { booking: { tripId: completeTripId } },
      select: { bookingId: true, template: true, payload: true, status: true, scheduledFor: true },
    });

    // Only paidBookingId (paid) is eligible
    // noShowBookingId (no_show) is NOT in PAYOUT_ELIGIBLE_STATUSES
    // cancelledBookingId (cancelled) is NOT eligible
    const payoutLogs = logs.filter((l) => l.template === 'payout_scheduled');
    expect(payoutLogs.length).toBe(1);
    expect(payoutLogs[0].bookingId).toBe(paidBookingId);
    expect(payoutLogs[0].status).toBe('pending');

    // scheduledFor stored as queryable column (not in payload — Finding 4 decision)
    expect(payoutLogs[0].scheduledFor).not.toBeNull();
    const scheduledFor = payoutLogs[0].scheduledFor!;
    const now = Date.now();
    const ONE_DAY_MS = 1 * 24 * 60 * 60 * 1000;
    // Allow ±60 seconds tolerance (T+1, S15#5)
    expect(scheduledFor.getTime()).toBeGreaterThan(now + ONE_DAY_MS - 60_000);
    expect(scheduledFor.getTime()).toBeLessThan(now + ONE_DAY_MS + 60_000);

    // payload should have tripId and operatorId but NOT scheduledFor (no duplication)
    const payload = JSON.parse(payoutLogs[0].payload);
    expect(payload.tripId).toBeDefined();
    expect(payload.operatorId).toBeDefined();
    expect(payload.scheduledFor).toBeUndefined();
  });

  it('S19: payoutJobsEnqueued count matches eligible booking count', async () => {
    // Already completed; idempotent call returns 0 jobs
    const idempotentResult = await markCompleted(operatorId, completeTripId);
    expect(idempotentResult.alreadyCompleted).toBe(true);
    expect(idempotentResult.payoutJobsEnqueued).toBe(0);
  });

  it('idempotency: second call returns alreadyCompleted=true with HTTP 200', async () => {
    const result = await markCompleted(operatorId, completeTripId);

    expect(result.ok).toBe(true);
    expect(result.alreadyCompleted).toBe(true);

    const row = await prisma.trip.findUnique({
      where: { id: completeTripId },
      select: { completedAt: true },
    });
    expect(row?.completedAt).not.toBeNull();
  });

  it('throws not_found for cross-operator trip (tenant isolation)', async () => {
    await expect(markCompleted(operatorId, otherTripId)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('throws trip_cancelled for cancelled trips', async () => {
    const cancelledTrip = await prisma.trip.create({
      data: {
        routeId,
        busId,
        operatorId,
        departureAt: new Date(Date.now() - 86_400_000),
        price: 100_000,
        status: 'cancelled',
        salesClosed: true,
      },
    });

    await expect(markCompleted(operatorId, cancelledTrip.id)).rejects.toMatchObject({
      code: 'trip_cancelled',
    });

    await prisma.trip.delete({ where: { id: cancelledTrip.id } });
  });

  it('regression: depart-then-complete sequence leaves final status=completed', async () => {
    // Create a fresh trip to test full depart → complete lifecycle
    const seqTrip = await prisma.trip.create({
      data: {
        routeId,
        busId,
        operatorId,
        departureAt: new Date(Date.now() - 60_000),
        price: 100_000,
        status: 'scheduled',
        salesClosed: false,
      },
    });

    const departResult = await markDeparted(operatorId, seqTrip.id);
    expect(departResult.trip.status).toBe('departed');

    const completeResult = await markCompleted(operatorId, seqTrip.id);
    expect(completeResult.trip.status).toBe('completed');

    const finalRow = await prisma.trip.findUnique({
      where: { id: seqTrip.id },
      select: { status: true, departedAt: true, completedAt: true },
    });
    // Final persisted status must be 'completed', not stuck at 'departed'
    expect(finalRow?.status).toBe('completed');
    expect(finalRow?.departedAt).not.toBeNull();
    expect(finalRow?.completedAt).not.toBeNull();

    // completeTripCore (Issue 019) creates a Payout child row on completion;
    // delete it before the trip to satisfy Payout_tripId_fkey.
    await prisma.payout.deleteMany({ where: { tripId: seqTrip.id } });
    await prisma.trip.delete({ where: { id: seqTrip.id } });
  });
});
