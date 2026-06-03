/**
 * Integration tests for the PSP-window awaiting_payment capacity protection (Issue 100).
 *
 * Requires a real PostgreSQL database. Run with: pnpm vitest:int
 *
 * AC1: An awaiting_payment booking created within PSP_WINDOW_MINUTES blocks a
 *      new hold on the same trip — the seat is protected during the payment
 *      confirmation window.
 * AC2: An awaiting_payment booking created BEYOND PSP_WINDOW_MINUTES does NOT
 *      block a new hold — the seat is released once the PSP window has elapsed.
 *
 * Negative control: a 'paid' booking always blocks (baseline).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/core/db/client';
import { createHold, PSP_WINDOW_MINUTES } from '../holdRepo';

const CAPACITY = 1; // single-seat bus makes oversell assertions unambiguous

let operatorId: string;
let busId: string;
let routeId: string;
let tripId: string;

async function makeAwaitingPaymentBooking(createdAt: Date): Promise<string> {
  const id = randomUUID();
  // Use $executeRaw to set createdAt to an arbitrary past instant
  // (Prisma's create() ignores createdAt when the DB default is @default(now())).
  await prisma.$executeRaw`
    INSERT INTO "Booking"
      (id, "bookingRef", "confirmationToken", "tripId",
       "buyerName", "buyerPhone", "ticketCount", "totalVnd",
       "paymentMethod", status, "createdAt")
    VALUES (
      ${id}::uuid,
      ${'PSPW-' + id.slice(0, 8)},
      ${randomUUID()},
      ${tripId}::uuid,
      'PSP Window Test',
      '+8490xxxxxx0',
      ${CAPACITY},
      100000,
      'momo'::"PaymentMethod",
      'awaiting_payment'::"BookingStatus",
      ${createdAt}
    )
  `;
  return id;
}

beforeAll(async () => {
  const operator = await prisma.operator.create({
    data: {
      legalName: 'PSP Window Test Operator',
      contactPhone: '+8490xxxxxx1',
      contactEmail: 'pspw@test.test',
      notificationPhone: '+8490xxxxxx2',
      status: 'APPROVED',
    },
  });
  operatorId = operator.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: CAPACITY, licensePlate: 'TEST-PSPW-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: { origin: 'PSP Window Origin', destination: 'PSP Window Dest', operatorId, durationMinutes: 120 },
  });
  routeId = route.id;

  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      price: 100_000,
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

describe('PSP-window awaiting_payment capacity protection (Issue 100)', () => {
  it('AC1: awaiting_payment within PSP window blocks a new hold', async () => {
    // Booking created 5 min ago — well within the 20-min PSP window.
    const withinWindowAt = new Date(Date.now() - 5 * 60 * 1000);
    await makeAwaitingPaymentBooking(withinWindowAt);

    const result = await createHold({
      tripId,
      ticketCount: 1,
      customerPhone: '+8490xxxxxx3',
      customerName: 'New Buyer',
    });

    // Hold should be blocked: the 1-seat capacity is occupied by the awaiting_payment booking.
    expect(result).toBeNull();
  });

  it('AC2: awaiting_payment beyond PSP window does NOT block a new hold', async () => {
    // Booking created PSP_WINDOW_MINUTES + 5 min ago — outside the window.
    const beyondWindowAt = new Date(Date.now() - (PSP_WINDOW_MINUTES + 5) * 60 * 1000);
    await makeAwaitingPaymentBooking(beyondWindowAt);

    const result = await createHold({
      tripId,
      ticketCount: 1,
      customerPhone: '+8490xxxxxx4',
      customerName: 'New Buyer 2',
    });

    // Hold should succeed: the expired awaiting_payment booking no longer blocks.
    expect(result).not.toBeNull();
    expect(result!.holdId).toBeDefined();
  });

  it('Baseline: a paid booking always blocks regardless of age', async () => {
    // Paid booking created far in the past — should always block.
    const paidBookingId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Booking"
        (id, "bookingRef", "confirmationToken", "tripId",
         "buyerName", "buyerPhone", "ticketCount", "totalVnd",
         "paymentMethod", status, "createdAt")
      VALUES (
        ${paidBookingId}::uuid,
        ${'PSPW-PAID-' + paidBookingId.slice(0, 6)},
        ${randomUUID()},
        ${tripId}::uuid,
        'Paid Baseline',
        '+8490xxxxxx5',
        ${CAPACITY},
        100000,
        'momo'::"PaymentMethod",
        'paid'::"BookingStatus",
        ${new Date(Date.now() - 2 * PSP_WINDOW_MINUTES * 60 * 1000)}
      )
    `;

    const result = await createHold({
      tripId,
      ticketCount: 1,
      customerPhone: '+8490xxxxxx6',
      customerName: 'Latecomer',
    });

    expect(result).toBeNull(); // always blocked by paid booking
  });
});
