/**
 * Integration tests for bookingRepo.createOnlineBookingFromHold() +
 * getBookingByConfirmationToken().
 *
 * Online-only (Issue 039): createCashBookingFromHold was removed; these tests
 * now exercise the online repo path (momo) for the shared insert/idempotency/
 * capacity behaviour.
 *
 * Requires a real PostgreSQL database with the schema applied.
 * Run with: pnpm test:integration
 *
 * Tests:
 *  1. Single insert succeeds when hold is active + unexpired.
 *  2. Idempotent: 2 calls with the same holdId → both succeed; second returns
 *     already_booked (race-safe via ON CONFLICT (holdId) DO NOTHING).
 *  3. Hold expired → hold_expired.
 *  4. Hold already consumed → hold_expired (treated as ineligible).
 *  5. getBookingByConfirmationToken returns the full payload.
 *  6. getBookingByConfirmationToken returns null for unknown token.
 *  7. 10 parallel inserts with the same holdId → exactly 1 ok, 9 already_booked.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { createHold } from '@/lib/core/db/holdRepo';
import {
  createOnlineBookingFromHold,
  getBookingByConfirmationToken,
} from '../bookingRepo';

// Online-only: all shared-behaviour tests exercise the momo rail.
// Issue 089: consentVersion is required by createOnlineBookingFromHold; default it
// here so the existing test bodies don't all have to thread it.
function createBookingFromHold(input: {
  holdId: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string | null;
  customerId?: string | null;
  consentVersion?: string;
}) {
  return createOnlineBookingFromHold(
    { ...input, consentVersion: input.consentVersion ?? '2026-06-01' },
    'momo'
  );
}

let operatorId: string;
let routeId: string;
let busId: string;
let busId_cap1: string;
let tripId: string;
let tripId_cap1: string;

beforeAll(async () => {
  const operator = await prisma.operator.create({
    data: {
      legalName: 'BookingRepo Test Operator',
      contactPhone: '+8490xxxxxx3',
      contactEmail: 'test@bookingrepo.test',
      notificationPhone: '+8490xxxxxx4',
    },
  });
  operatorId = operator.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 10, licensePlate: 'TEST-BR-001', busType: 'coach' },
  });
  busId = bus.id;

  const bus1 = await prisma.bus.create({
    data: { operatorId, capacity: 1, licensePlate: 'TEST-BR-002', busType: 'coach' },
  });
  busId_cap1 = bus1.id;

  const route = await prisma.route.create({
    data: { origin: 'BR Test Origin', destination: 'BR Test Destination', operatorId, durationMinutes: 240 },
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

  const trip1 = await prisma.trip.create({
    data: {
      routeId,
      busId: busId_cap1,
      operatorId,
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      price: 100000,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  tripId_cap1 = trip1.id;
});

afterEach(async () => {
  // Isolation: scope the NotificationLog wipe to THIS file's bookings — a global
  // deleteMany({}) here nukes pending notification rows other files enqueued and
  // are about to dispatch/assert on. NotificationLog.bookingId → Booking is
  // onDelete:Cascade, so the booking delete below also clears these, but we delete
  // explicitly first to avoid relying on cascade ordering.
  await prisma.notificationLog.deleteMany({ where: { booking: { tripId: { in: [tripId, tripId_cap1] } } } });
  await prisma.booking.deleteMany({ where: { tripId: { in: [tripId, tripId_cap1] } } });
  await prisma.hold.deleteMany({ where: { tripId: { in: [tripId, tripId_cap1] } } });
});

afterAll(async () => {
  await prisma.notificationLog.deleteMany({ where: { booking: { tripId: { in: [tripId, tripId_cap1] } } } });
  await prisma.booking.deleteMany({ where: { tripId: { in: [tripId, tripId_cap1] } } });
  await prisma.hold.deleteMany({ where: { tripId: { in: [tripId, tripId_cap1] } } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

async function activeHold(ticketCount = 1): Promise<string> {
  const h = await createHold({
    tripId,
    ticketCount,
    customerPhone: '+8490xxxxxx1',
    customerName: 'Hold Holder',
    customerEmail: 'holder@example.com',
  });
  if (!h) throw new Error('hold setup failed');
  return h.holdId;
}

describe('createOnlineBookingFromHold (momo)', () => {
  it('succeeds when hold is active and unexpired', async () => {
    const holdId = await activeHold(2);
    const r = await createBookingFromHold({
      holdId,
      buyerName: 'Buyer A',
      buyerPhone: '+8490xxxxxx5',
      buyerEmail: 'buyera@example.com',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.booking.tripId).toBe(tripId);
    expect(r.booking.holdId).toBe(holdId);
    expect(r.booking.ticketCount).toBe(2);
    expect(r.booking.totalVnd).toBe(200000);
    expect(r.booking.status).toBe('awaiting_payment');
    expect(r.booking.paymentMethod).toBe('momo');
    // Issue 042: buyerEmail persists through the insert + RETURNING.
    expect(r.booking.buyerEmail).toBe('buyera@example.com');
    expect(r.booking.bookingRef).toMatch(/^BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}$/);
    expect(r.booking.confirmationToken).toMatch(/^[A-Za-z0-9_-]{32}$/);

    // Hold should be flipped to consumed
    const hold = await prisma.hold.findUnique({ where: { id: holdId } });
    expect(hold?.status).toBe('consumed');

    // Issue 089: two ConsentRecord rows written in the same tx (no_refund + pii_storage)
    const consents = await prisma.consentRecord.findMany({
      where: { bookingId: r.booking.id },
      orderBy: { consentType: 'asc' },
    });
    expect(consents.map((c) => c.consentType)).toEqual(['no_refund', 'pii_storage']);
    expect(consents.every((c) => c.version === '2026-06-01')).toBe(true);
  });

  it('Issue 111: a custom-pickup hold→booking carries pickupKind=custom + derived flag + detail', async () => {
    // Custom hold: the CHECK constraint requires a ≥5-char detail, so a valid one is supplied.
    const h = await createHold({
      tripId,
      ticketCount: 1,
      customerPhone: '+8490xxxxxx1',
      customerName: 'Custom Holder',
      customerEmail: 'custom@example.com',
      pickupKind: 'custom',
      pickupAreaId: null,
      pickupAreaLabel: null,
      pickupDetail: '12 Lê Lợi, phường X',
    });
    expect(h).not.toBeNull();

    // The flag is DERIVED IN SQL from pickupKind on the Hold itself.
    const holdRow = await prisma.hold.findUnique({
      where: { id: h!.holdId },
      select: { pickupKind: true, customPickupRequested: true, pickupDetail: true },
    });
    expect(holdRow?.pickupKind).toBe('custom');
    expect(holdRow?.customPickupRequested).toBe(true);
    expect(holdRow?.pickupDetail).toBe('12 Lê Lợi, phường X');

    const r = await createBookingFromHold({
      holdId: h!.holdId,
      buyerName: 'Custom Buyer',
      buyerPhone: '+8490xxxxxx5',
      buyerEmail: 'custombuyer@example.com',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // The booking snapshot derives customPickupRequested from the hold's pickupKind (not a copied column).
    const bookingRow = await prisma.booking.findUnique({
      where: { id: r.booking.id },
      select: {
        pickupKind: true,
        customPickupRequested: true,
        pickupAreaId: true,
        pickupDetail: true,
      },
    });
    expect(bookingRow?.pickupKind).toBe('custom');
    expect(bookingRow?.customPickupRequested).toBe(true);
    expect(bookingRow?.pickupAreaId).toBeNull();
    expect(bookingRow?.pickupDetail).toBe('12 Lê Lợi, phường X');
  });

  it('stamps customerId when provided and leaves it null when omitted (Issue 031)', async () => {
    // Booking.customerId is a real FK → Customer.id, so the signed-in case needs
    // a real customer row (onDelete: SetNull lets us drop it before the booking).
    const customer = await prisma.customer.create({
      data: { phone: '+8490xxxxxx7', displayName: 'Auth Buyer' },
    });
    try {
      // Logged-in booking: customerId stamped at creation.
      const holdAuth = await activeHold(1);
      const rAuth = await createBookingFromHold({
        holdId: holdAuth,
        buyerName: 'Buyer Auth',
        buyerPhone: '+8490xxxxxx5',
        customerId: customer.id,
      });
      expect(rAuth.ok).toBe(true);
      if (!rAuth.ok) return;
      const rowAuth = await prisma.booking.findUnique({
        where: { id: rAuth.booking.id },
        select: { customerId: true },
      });
      expect(rowAuth?.customerId).toBe(customer.id);

      // Guest booking: customerId omitted → stays null.
      const holdGuest = await activeHold(1);
      const rGuest = await createBookingFromHold({
        holdId: holdGuest,
        buyerName: 'Buyer Guest',
        buyerPhone: '+8490xxxxxx5',
      });
      expect(rGuest.ok).toBe(true);
      if (!rGuest.ok) return;
      const rowGuest = await prisma.booking.findUnique({
        where: { id: rGuest.booking.id },
        select: { customerId: true },
      });
      expect(rowGuest?.customerId).toBeNull();
    } finally {
      await prisma.booking.updateMany({
        where: { customerId: customer.id },
        data: { customerId: null },
      });
      await prisma.customer.delete({ where: { id: customer.id } });
    }
  });

  it('second call with same holdId returns already_booked (idempotent)', async () => {
    const holdId = await activeHold(1);
    const r1 = await createBookingFromHold({
      holdId,
      buyerName: 'Buyer B',
      buyerPhone: '+8490xxxxxx5',
    });
    expect(r1.ok).toBe(true);

    const r2 = await createBookingFromHold({
      holdId,
      buyerName: 'Buyer B',
      buyerPhone: '+8490xxxxxx5',
    });
    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.reason).toBe('already_booked');

    const bookings = await prisma.booking.findMany({ where: { holdId } });
    expect(bookings.length).toBe(1);
  });

  it('returns hold_expired when hold is past expiry', async () => {
    const holdId = await activeHold(1);
    // Force-expire the hold
    await prisma.hold.update({
      where: { id: holdId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const r = await createBookingFromHold({
      holdId,
      buyerName: 'Buyer C',
      buyerPhone: '+8490xxxxxx5',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('hold_expired');
  });

  it('returns hold_expired when hold is already consumed', async () => {
    const holdId = await activeHold(1);
    await prisma.hold.update({
      where: { id: holdId },
      data: { status: 'consumed' },
    });
    const r = await createBookingFromHold({
      holdId,
      buyerName: 'Buyer D',
      buyerPhone: '+8490xxxxxx5',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('hold_expired');
  });

  it('10 parallel inserts with same holdId → exactly 1 ok, 9 already_booked', async () => {
    const holdId = await activeHold(1);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        createBookingFromHold({
          holdId,
          buyerName: 'Race Buyer',
          buyerPhone: '+8490xxxxxx5',
        })
      )
    );
    const okCount = results.filter((r) => r.ok).length;
    const dupCount = results.filter((r) => !r.ok && r.reason === 'already_booked').length;
    expect(okCount).toBe(1);
    expect(dupCount).toBe(9);

    const bookings = await prisma.booking.findMany({ where: { holdId } });
    expect(bookings.length).toBe(1);
  });
});

describe('capacity correctness — bookings subtract from holdRepo availability', () => {
  it('after a hold→booking, a new hold on same cap-1 trip is refused', async () => {
    // Step 1: place hold + convert to booking on the capacity-1 trip
    const firstHold = await createHold({
      tripId: tripId_cap1,
      ticketCount: 1,
      customerPhone: '+8490xxxxxx1',
      customerName: 'First',
    });
    expect(firstHold).not.toBeNull();
    const r = await createBookingFromHold({
      holdId: firstHold!.holdId,
      buyerName: 'Buyer',
      buyerPhone: '+8490xxxxxx5',
    });
    expect(r.ok).toBe(true);

    // Step 2: try to place a new hold — should fail because the booking
    // (status=awaiting_payment) now occupies the seat.
    const secondHold = await createHold({
      tripId: tripId_cap1,
      ticketCount: 1,
      customerPhone: '+8490xxxxxx2',
      customerName: 'Second',
    });
    expect(secondHold).toBeNull();
  });
});

describe('createOnlineBookingFromHold — concurrent sell (issue 036)', () => {
  it('10 parallel online sells with same holdId → exactly 1 ok, 9 already_booked', async () => {
    // The trip row is locked FOR UPDATE OF t at the top of each sell txn, so the
    // racing conversions serialize; ON CONFLICT (holdId) then guarantees exactly
    // one booking. The other sells see the row and return already_booked — never
    // an oversell (the seat was already capacity-bounded at hold creation).
    const holdId = await activeHold(1);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        createOnlineBookingFromHold(
          { holdId, buyerName: 'Race Buyer', buyerPhone: '+8490xxxxxx5', consentVersion: '2026-06-01' },
          'momo'
        )
      )
    );
    const okCount = results.filter((r) => r.ok).length;
    const dupCount = results.filter((r) => !r.ok && r.reason === 'already_booked').length;
    expect(okCount).toBe(1);
    expect(dupCount).toBe(9);

    const bookings = await prisma.booking.findMany({ where: { holdId } });
    expect(bookings.length).toBe(1);
    expect(bookings[0].status).toBe('awaiting_payment');
    expect(bookings[0].paymentMethod).toBe('momo');

    const hold = await prisma.hold.findUnique({ where: { id: holdId } });
    expect(hold?.status).toBe('consumed');
  });
});

describe('getBookingByConfirmationToken', () => {
  it('returns the booking with full trip/route/operator details', async () => {
    const holdId = await activeHold(1);
    const r = await createBookingFromHold({
      holdId,
      buyerName: 'Buyer E',
      buyerPhone: '+8490xxxxxx5',
    });
    if (!r.ok) throw new Error('setup failed');

    const fetched = await getBookingByConfirmationToken(r.booking.confirmationToken);
    expect(fetched).not.toBeNull();
    expect(fetched?.bookingRef).toBe(r.booking.bookingRef);
    expect(fetched?.trip.route.origin).toBe('BR Test Origin');
    expect(fetched?.trip.route.destination).toBe('BR Test Destination');
    expect(fetched?.trip.bus.operator.legalName).toBe('BookingRepo Test Operator');
    expect(fetched?.trip.bus.licensePlate).toBe('TEST-BR-001');
  });

  it('returns null for an unknown token', async () => {
    const fetched = await getBookingByConfirmationToken(
      'a'.repeat(32)
    );
    expect(fetched).toBeNull();
  });
});
