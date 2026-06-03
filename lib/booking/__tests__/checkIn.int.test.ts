/**
 * Issue 073 — checkIn integration tests (DB-gated). Run with: pnpm vitest:int
 *
 * The AC2 concurrent test: two checkInBooking calls race on the SAME booking via
 * Promise.all + real transactions. The atomic conditional UPDATE
 * (`WHERE "checkedInAt" IS NULL`) guarantees EXACTLY ONE rowcount-1 →
 * exactly one { alreadyCheckedIn:false }, the other { alreadyCheckedIn:true }.
 *
 * Also: markNoShow is blocked once a booking has been checked in (can't no-show
 * an already-boarded passenger); markNoShow on a clean paid booking sets both
 * status='no_show' AND noShowAt together (Issue 014 pairing).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db/client';
import { checkInBooking, markNoShow, scanTicket } from '../checkIn';
import { mintTicketToken } from '@/lib/ticketing/ticketToken';

let operatorId: string;
let otherOperatorId: string;
let tripId: string;
let otherTripId: string;

async function makeBooking(
  tripIdParam: string,
  ref: string,
  ct: string,
  status = 'paid',
): Promise<string> {
  const id = randomUUID();
  await prisma.booking.create({
    data: {
      id,
      bookingRef: ref,
      confirmationToken: ct,
      tripId: tripIdParam,
      buyerName: 'Check-In Tester',
      buyerPhone: '+8490xxxxxx2',
      ticketCount: 2,
      totalVnd: 200_000,
      paymentMethod: 'momo',
      status: status as 'paid',
    },
  });
  return id;
}

beforeAll(async () => {
  const opA = await prisma.operator.create({
    data: { legalName: 'CheckIn Op A', contactPhone: '+8490xxxxxx3', contactEmail: 'cia@checkin.dev' },
  });
  operatorId = opA.id;
  const opB = await prisma.operator.create({
    data: { legalName: 'CheckIn Op B', contactPhone: '+8490xxxxxx4', contactEmail: 'cib@checkin.dev' },
  });
  otherOperatorId = opB.id;

  const routeA = await prisma.route.create({
    data: { origin: 'CI Origin', destination: 'CI Dest', operatorId, durationMinutes: 120 },
  });
  const busA = await prisma.bus.create({
    data: { operatorId, capacity: 30, licensePlate: 'CHKIN-001', busType: 'coach' },
  });
  const tripA = await prisma.trip.create({
    data: { routeId: routeA.id, busId: busA.id, operatorId, departureAt: new Date(Date.now() + 2 * 86_400_000), price: 100_000 },
  });
  tripId = tripA.id;

  const routeB = await prisma.route.create({
    data: { origin: 'CI B Origin', destination: 'CI B Dest', operatorId: otherOperatorId, durationMinutes: 60 },
  });
  const busB = await prisma.bus.create({
    data: { operatorId: otherOperatorId, capacity: 20, licensePlate: 'CHKIN-B01', busType: 'coach' },
  });
  const tripB = await prisma.trip.create({
    data: { routeId: routeB.id, busId: busB.id, operatorId: otherOperatorId, departureAt: new Date(Date.now() + 86_400_000), price: 80_000 },
  });
  otherTripId = tripB.id;
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { trip: { operatorId: { in: [operatorId, otherOperatorId] } } } });
  await prisma.trip.deleteMany({ where: { operatorId: { in: [operatorId, otherOperatorId] } } });
  await prisma.route.deleteMany({ where: { operatorId: { in: [operatorId, otherOperatorId] } } });
  await prisma.bus.deleteMany({ where: { operatorId: { in: [operatorId, otherOperatorId] } } });
  await prisma.operator.deleteMany({ where: { id: { in: [operatorId, otherOperatorId] } } });
});

describe('checkInBooking — single-use guard', () => {
  it('AC2: two concurrent check-ins → exactly one alreadyCheckedIn:false', async () => {
    const bookingId = await makeBooking(tripId, 'BB-2026-ci01-aaa1', 'ct-' + randomUUID());

    const [a, b] = await Promise.all([
      checkInBooking(prisma, { bookingId, operatorId }),
      checkInBooking(prisma, { bookingId, operatorId }),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    const flags = [a, b].map((r) => (r.ok ? r.alreadyCheckedIn : null));
    // Exactly one fresh check-in (false), exactly one idempotent (true).
    expect(flags.filter((f) => f === false)).toHaveLength(1);
    expect(flags.filter((f) => f === true)).toHaveLength(1);

    const row = await prisma.booking.findUnique({ where: { id: bookingId }, select: { checkedInAt: true } });
    expect(row?.checkedInAt).not.toBeNull();
  });

  it('cross-operator bookingId → not_found (no mutation)', async () => {
    const bookingId = await makeBooking(otherTripId, 'BB-2026-ci01-bbb2', 'ct-' + randomUUID());

    const res = await checkInBooking(prisma, { bookingId, operatorId });
    expect(res).toEqual({ ok: false, reason: 'not_found' });

    const row = await prisma.booking.findUnique({ where: { id: bookingId }, select: { checkedInAt: true } });
    expect(row?.checkedInAt).toBeNull();
  });
});

describe('markNoShow', () => {
  it('sets status=no_show AND noShowAt together on a clean paid booking', async () => {
    const bookingId = await makeBooking(tripId, 'BB-2026-ci01-ccc3', 'ct-' + randomUUID());

    const res = await markNoShow(prisma, { bookingId, operatorId });
    expect(res).toEqual({ ok: true });

    const row = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true, noShowAt: true } });
    expect(row?.status).toBe('no_show');
    expect(row?.noShowAt).not.toBeNull();
  });

  it('blocked after check-in → already_checked_in, status unchanged', async () => {
    const bookingId = await makeBooking(tripId, 'BB-2026-ci01-ddd4', 'ct-' + randomUUID());

    const checkedIn = await checkInBooking(prisma, { bookingId, operatorId });
    expect(checkedIn).toEqual({ ok: true, alreadyCheckedIn: false });

    const res = await markNoShow(prisma, { bookingId, operatorId });
    expect(res).toEqual({ ok: false, reason: 'already_checked_in' });

    const row = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true, noShowAt: true } });
    expect(row?.status).toBe('paid');
    expect(row?.noShowAt).toBeNull();
  });
});

describe('scanTicket — DB-backed', () => {
  it('paid booking on the operator trip → ok with boarding view', async () => {
    const ct = 'ct-' + randomUUID();
    const ref = 'BB-2026-ci01-eee5';
    await makeBooking(tripId, ref, ct);
    const token = await mintTicketToken({ bookingRef: ref, confirmationToken: ct });

    const res = await scanTicket(prisma, { token, operatorId });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.booking.bookingRef).toBe(ref);
      expect(res.booking.buyerName).toBe('Check-In Tester');
    }
  });

  it('booking on another operator trip → wrong_operator (no leak)', async () => {
    const ct = 'ct-' + randomUUID();
    const ref = 'BB-2026-ci01-fff6';
    await makeBooking(otherTripId, ref, ct);
    const token = await mintTicketToken({ bookingRef: ref, confirmationToken: ct });

    const res = await scanTicket(prisma, { token, operatorId });
    expect(res).toEqual({ ok: false, reason: 'wrong_operator' });
  });
});
