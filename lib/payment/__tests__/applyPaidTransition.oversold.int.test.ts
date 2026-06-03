/**
 * Integration tests for the oversold-race guard in applyPaidStatusTransition (Issue 100).
 *
 * Requires a real PostgreSQL database. Run with: pnpm vitest:int
 *
 * Scenario: bus capacity = 1; two bookings for the same trip both reach
 * awaiting_payment (which the PSP window now protects during checkout). When
 * both PSP webhooks arrive (race), the first paid transition claims the seat;
 * the second paid transition detects oversell and immediately flips the booking
 * to 'refunded' + sets refundedAt.
 *
 * ACs tested:
 *  1. First paid transition: updated=1, refundTriggered=false, booking status='paid'
 *  2. Second paid transition (oversold): updated=1, refundTriggered=true,
 *     booking status='refunded', refundedAt NOT NULL
 *  3. Replay of an already-paid booking: updated=0, refundTriggered=false
 *  4. Booking with no legal predecessor (e.g. already 'payment_failed_expired'):
 *     updated=0, refundTriggered=false
 *  5. Issue 014: refundedAt and status='refunded' written in the same update
 *     (both non-null in a single DB round-trip — verified by reading both after).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/client';
import { applyPaidStatusTransition } from '../applyPaidTransition';

const CAPACITY = 1; // single-seat forces oversell on the second payment

let operatorId: string;
let busId: string;
let routeId: string;
let tripId: string;

async function makeAwaitingPaymentBooking(tickets = 1): Promise<string> {
  const id = randomUUID();
  await prisma.booking.create({
    data: {
      id,
      bookingRef: 'APT-' + id.slice(0, 8),
      confirmationToken: randomUUID(),
      tripId,
      buyerName: 'Oversold Test Buyer',
      buyerPhone: '+8490xxxxxx0',
      ticketCount: tickets,
      totalVnd: 100_000,
      paymentMethod: 'momo',
      status: 'awaiting_payment',
    },
  });
  return id;
}

beforeAll(async () => {
  const operator = await prisma.operator.create({
    data: {
      legalName: 'Oversold Test Operator',
      contactPhone: '+8490xxxxxx1',
      contactEmail: 'oversold@test.test',
      notificationPhone: '+8490xxxxxx2',
      status: 'APPROVED',
    },
  });
  operatorId = operator.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: CAPACITY, licensePlate: 'TEST-OVS-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: {
      origin: 'Oversold Origin',
      destination: 'Oversold Dest',
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
      departureAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      price: 100_000,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  tripId = trip.id;
});

afterEach(async () => {
  await prisma.booking.deleteMany({ where: { tripId } });
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { tripId } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('applyPaidStatusTransition oversold-race guard (Issue 100)', () => {
  it('AC1: first paid transition — updated=1, refundTriggered=false, booking=paid', async () => {
    const bookingId = await makeAwaitingPaymentBooking();

    const result = await prisma.$transaction((tx) =>
      applyPaidStatusTransition(tx, bookingId, 'psp-txn-001')
    );

    expect(result.updated).toBe(1);
    expect(result.refundTriggered).toBe(false);

    const row = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true, refundedAt: true } });
    expect(row?.status).toBe('paid');
    expect(row?.refundedAt).toBeNull();
  });

  it('AC2: second paid transition (oversold) — updated=1, refundTriggered=true, booking=refunded + refundedAt set', async () => {
    // Booking A: already paid (claims the 1 seat)
    const bookingA = await makeAwaitingPaymentBooking();
    await prisma.$transaction((tx) =>
      applyPaidStatusTransition(tx, bookingA, 'psp-txn-A')
    );

    // Booking B: also awaiting_payment — 2nd webhook arrives
    const bookingB = await makeAwaitingPaymentBooking();

    const result = await prisma.$transaction((tx) =>
      applyPaidStatusTransition(tx, bookingB, 'psp-txn-B')
    );

    expect(result.updated).toBe(1);
    expect(result.refundTriggered).toBe(true);

    // Issue 014 assertion: both status='refunded' AND refundedAt written in same tx.
    const row = await prisma.booking.findUnique({
      where: { id: bookingB },
      select: { status: true, refundedAt: true },
    });
    expect(row?.status).toBe('refunded');
    expect(row?.refundedAt).not.toBeNull();
    expect(row?.refundedAt).toBeInstanceOf(Date);
  });

  it('AC3: replay of already-paid booking — updated=0, refundTriggered=false', async () => {
    const bookingId = await makeAwaitingPaymentBooking();

    // First transition
    await prisma.$transaction((tx) =>
      applyPaidStatusTransition(tx, bookingId, 'psp-txn-replay')
    );

    // Replay: booking is already 'paid', not a legal predecessor of 'paid' again
    const replay = await prisma.$transaction((tx) =>
      applyPaidStatusTransition(tx, bookingId, 'psp-txn-replay')
    );

    expect(replay.updated).toBe(0);
    expect(replay.refundTriggered).toBe(false);
  });

  it('AC4: non-legal-predecessor (payment_failed_expired) — updated=0, refundTriggered=false', async () => {
    const bookingId = await makeAwaitingPaymentBooking();

    // Manually advance to payment_failed_expired
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'payment_failed_expired' },
    });

    const result = await prisma.$transaction((tx) =>
      applyPaidStatusTransition(tx, bookingId, 'psp-txn-expired')
    );

    expect(result.updated).toBe(0);
    expect(result.refundTriggered).toBe(false);

    const row = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
    // Status must not have regressed
    expect(row?.status).toBe('payment_failed_expired');
  });

  it('AC5 (full lifecycle): first paid succeeds, second oversold → refunded, first stays paid', async () => {
    const bookingA = await makeAwaitingPaymentBooking();
    const bookingB = await makeAwaitingPaymentBooking();

    // Sequential (not truly concurrent, but exercises the same code path)
    const resultA = await prisma.$transaction((tx) =>
      applyPaidStatusTransition(tx, bookingA, 'psp-lifecycle-A')
    );
    const resultB = await prisma.$transaction((tx) =>
      applyPaidStatusTransition(tx, bookingB, 'psp-lifecycle-B')
    );

    expect(resultA).toEqual({ updated: 1, refundTriggered: false });
    expect(resultB).toEqual({ updated: 1, refundTriggered: true });

    const [rowA, rowB] = await Promise.all([
      prisma.booking.findUnique({ where: { id: bookingA }, select: { status: true, refundedAt: true } }),
      prisma.booking.findUnique({ where: { id: bookingB }, select: { status: true, refundedAt: true } }),
    ]);

    expect(rowA?.status).toBe('paid');
    expect(rowA?.refundedAt).toBeNull();
    expect(rowB?.status).toBe('refunded');
    expect(rowB?.refundedAt).not.toBeNull();
  });
});
