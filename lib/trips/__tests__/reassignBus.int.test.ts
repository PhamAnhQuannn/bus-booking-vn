/**
 * Integration tests for Issue 075 — reassign invalidates/regenerates the ticket
 * PDF + notifies the new plate.
 *
 * Run with: pnpm vitest:int
 *
 * Covers (AC5):
 * - reassign NULLs ticketPdfKey/ticketPdfGeneratedAt for a paid booking that had one
 * - a pending 'busReassigned' NotificationLog row exists for that booking after reassign
 * - a SECOND reassign re-upserts in place: still exactly one busReassigned row per
 *   booking, status reset back to 'pending' (no duplicate rows, no unique crash)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/client';
import { randomUUID } from 'crypto';
import { reassignBus } from '../reassignBus';

let operatorId: string;
let routeId: string;
let busAId: string;
let busBId: string;
let busCId: string;
let tripId: string;
let paidBookingId: string;

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: {
      legalName: 'Reassign075 Test Op',
      contactPhone: '+8490xxxxxx5',
      contactEmail: 'reassign075@test.dev',
    },
  });
  operatorId = op.id;

  const busA = await prisma.bus.create({
    data: { operatorId, capacity: 30, licensePlate: 'RA-075A', busType: 'coach' },
  });
  busAId = busA.id;
  const busB = await prisma.bus.create({
    data: { operatorId, capacity: 30, licensePlate: 'RA-075B', busType: 'sleeper' },
  });
  busBId = busB.id;
  // Third bus so the second reassign also moves to a fresh, non-overlapping bus.
  const busC = await prisma.bus.create({
    data: { operatorId, capacity: 30, licensePlate: 'RA-075C', busType: 'limousine' },
  });
  busCId = busC.id;

  const route = await prisma.route.create({
    data: {
      origin: 'Reassign Origin',
      destination: 'Reassign Destination',
      operatorId,
      durationMinutes: 120,
    },
  });
  routeId = route.id;

  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId: busAId,
      operatorId,
      departureAt: new Date(Date.now() + 7 * 86_400_000), // a week out
      price: 100_000,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  tripId = trip.id;

  // Paid booking that ALREADY has a stored ticket PDF.
  const id = randomUUID();
  const booking = await prisma.booking.create({
    data: {
      id,
      bookingRef: 'BB-2026-r075-aaa1',
      confirmationToken: 'tok-r075-aaa1',
      tripId,
      buyerName: 'Reassign Tester',
      buyerPhone: '+8490xxxxxx6',
      ticketCount: 1,
      totalVnd: 100_000,
      paymentMethod: 'momo',
      status: 'paid_operator_notified',
      isManual: false,
      contactStatus: 'pending',
      ticketPdfKey: 'ticket_pdf/BB-2026-r075-aaa1.pdf',
      ticketPdfGeneratedAt: new Date(),
    },
  });
  paidBookingId = booking.id;
});

afterAll(async () => {
  await prisma.notificationLog.deleteMany({
    where: { booking: { trip: { operatorId } } },
  });
  await prisma.booking.deleteMany({ where: { trip: { operatorId } } });
  await prisma.trip.deleteMany({ where: { operatorId } });
  await prisma.route.deleteMany({ where: { operatorId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.deleteMany({ where: { id: operatorId } });
});

describe('reassignBus — Issue 075 PDF invalidation + new-plate notification', () => {
  it('AC5: reassign NULLs the ticketPdfKey and enqueues a pending busReassigned log', async () => {
    await reassignBus(operatorId, tripId, busBId);

    const booking = await prisma.booking.findUnique({
      where: { id: paidBookingId },
      select: { ticketPdfKey: true, ticketPdfGeneratedAt: true },
    });
    // PDF invalidated → 074 cron will re-render with the new plate.
    expect(booking?.ticketPdfKey).toBeNull();
    expect(booking?.ticketPdfGeneratedAt).toBeNull();

    const logs = await prisma.notificationLog.findMany({
      where: { bookingId: paidBookingId, template: 'busReassigned' },
      select: { status: true, recipient: true, payload: true },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe('pending');
    const payload = JSON.parse(logs[0].payload);
    // Payload carries the NEW plate (bus B).
    expect(payload.plate).toBe('RA-075B');
    expect(payload.bookingRef).toBe('BB-2026-r075-aaa1');
  });

  it('AC5: a second reassign re-upserts in place — one busReassigned row, status back to pending', async () => {
    // Simulate the dispatcher having marked the first row sent.
    await prisma.notificationLog.updateMany({
      where: { bookingId: paidBookingId, template: 'busReassigned' },
      data: { status: 'sent', sentAt: new Date(), attemptCount: 1 },
    });

    await reassignBus(operatorId, tripId, busCId);

    const logs = await prisma.notificationLog.findMany({
      where: { bookingId: paidBookingId, template: 'busReassigned' },
      select: { status: true, attemptCount: true, payload: true, nextAttemptAt: true },
    });
    // Still exactly ONE row (upsert, not a duplicate insert).
    expect(logs.length).toBe(1);
    // Re-armed for re-delivery of the LATEST plate.
    expect(logs[0].status).toBe('pending');
    expect(logs[0].attemptCount).toBe(0);
    expect(logs[0].nextAttemptAt).toBeNull();
    const payload = JSON.parse(logs[0].payload);
    expect(payload.plate).toBe('RA-075C');
  });
});
