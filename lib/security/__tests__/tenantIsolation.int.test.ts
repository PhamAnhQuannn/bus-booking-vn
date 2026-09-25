import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/core/db/client';
import { generateBookingRef } from '@/lib/core/id';

let opAId: string;
let opBId: string;
let opBBusId: string;
let opBRouteId: string;
let opBTripId: string;
let opBBookingId: string;
let opBStaffId: string;
let opBPayoutId: string;

describe('tenant isolation', () => {
  beforeAll(async () => {
    // Use the seed operator as operator A
    const seedOp = await prisma.operator.findFirst({ where: { status: 'APPROVED' } });
    if (!seedOp) throw new Error('No seed operator found — run prisma db seed first');
    opAId = seedOp.id;

    // Create operator B with full entity tree
    const opB = await prisma.operator.create({
      data: {
        legalName: 'Tenant Isolation Test Org',
        contactPhone: '+8490xxxxxx7',
        contactEmail: 'tenant-iso@test.example',
        status: 'APPROVED',
      },
    });
    opBId = opB.id;

    const bus = await prisma.bus.create({
      data: {
        licensePlate: 'ISO-TEST-01',
        capacity: 16,
        busType: 'coach',
        operatorId: opBId,
      },
    });
    opBBusId = bus.id;

    const route = await prisma.route.create({
      data: {
        origin: 'ISO Origin',
        destination: 'ISO Destination',
        durationMinutes: 120,
        operatorId: opBId,
      },
    });
    opBRouteId = route.id;

    const trip = await prisma.trip.create({
      data: {
        departureAt: new Date(Date.now() + 7 * 86_400_000),
        price: 100_000,
        status: 'scheduled',
        busId: opBBusId,
        routeId: opBRouteId,
        operatorId: opBId,
      },
    });
    opBTripId = trip.id;

    // Booking owned by operator B (tenant-scoped via trip.operatorId join).
    const booking = await prisma.booking.create({
      data: {
        id: randomUUID(),
        bookingRef: generateBookingRef(),
        confirmationToken: randomUUID().replace(/-/g, '') + 'ti',
        tripId: opBTripId,
        buyerName: 'ISO Buyer B',
        buyerPhone: '+8490xxxxxx5',
        ticketCount: 1,
        totalVnd: 100_000,
        paymentMethod: 'bank_transfer',
        status: 'awaiting_payment',
      },
    });
    opBBookingId = booking.id;

    // Staff member of operator B.
    const suffix = Date.now().toString(36);
    const staff = await prisma.operatorUser.create({
      data: {
        operatorId: opBId,
        username: `iso-staff-${suffix}`,
        phone: `+849000${suffix.slice(-6)}`,
        contactPhone: '+8490xxxxxx5',
        notificationPhone: '+8490xxxxxx5',
        passwordHash: 'x'.repeat(60),
        displayName: 'ISO Staff B',
        role: 'staff',
      },
    });
    opBStaffId = staff.id;

    // Payout owned by operator B.
    const payout = await prisma.payout.create({
      data: {
        operatorId: opBId,
        tripId: opBTripId,
        gross: BigInt(100_000),
        platformFee: BigInt(6_000),
        net: BigInt(94_000),
        scheduledAt: new Date(),
      },
    });
    opBPayoutId = payout.id;
  });

  afterAll(async () => {
    // Clean up in reverse FK order (Payout restricts Trip delete → drop payouts first).
    await prisma.payout.deleteMany({ where: { operatorId: opBId } });
    await prisma.booking.deleteMany({ where: { tripId: opBTripId } });
    await prisma.operatorUser.deleteMany({ where: { operatorId: opBId } });
    await prisma.trip.deleteMany({ where: { operatorId: opBId } });
    await prisma.route.deleteMany({ where: { operatorId: opBId } });
    await prisma.bus.deleteMany({ where: { operatorId: opBId } });
    await prisma.operator.delete({ where: { id: opBId } });
  });

  it('operator A cannot read operator B bus', async () => {
    const { getOperatorBus } = await import('@/lib/catalog');
    const result = await getOperatorBus(opAId, opBBusId);
    expect(result).toBeNull();
  });

  it('operator A cannot read operator B trip', async () => {
    const { getTrip } = await import('@/lib/trips');
    const result = await getTrip(opAId, opBTripId);
    expect(result).toBeNull();
  });

  it('operator A cannot read operator B route', async () => {
    const { getRouteById } = await import('@/lib/catalog');
    const result = await getRouteById({ operatorId: opAId, routeId: opBRouteId });
    expect(result).toBeNull();
  });

  it('operator A bus list does not contain operator B buses', async () => {
    const { listOperatorBuses } = await import('@/lib/catalog');
    const buses = await listOperatorBuses(opAId, { activeOnly: false });
    const busIds = buses.map((b: { id: string }) => b.id);
    expect(busIds).not.toContain(opBBusId);
  });

  it('operator A cannot read operator B booking (owner sees it — positive control)', async () => {
    const { getOperatorBooking } = await import('@/lib/booking');
    expect(await getOperatorBooking(opAId, opBBookingId)).toBeNull();
    // Owner B DOES see it — proves the null above is isolation, not a broken fixture.
    expect(await getOperatorBooking(opBId, opBBookingId)).not.toBeNull();
  });

  it('operator A staff roster excludes operator B staff (owner sees it — positive control)', async () => {
    const { listStaff } = await import('@/lib/staff');
    const aIds = (await listStaff(opAId)).map((s) => s.id);
    expect(aIds).not.toContain(opBStaffId);
    const bIds = (await listStaff(opBId)).map((s) => s.id);
    expect(bIds).toContain(opBStaffId);
  });

  it('operator A payout report excludes operator B payouts (owner sees it — positive control)', async () => {
    const { getPayoutReport } = await import('@/lib/ledger');
    const aIds = (await getPayoutReport({ operatorId: opAId })).map((p) => p.payoutId);
    expect(aIds).not.toContain(opBPayoutId);
    const bIds = (await getPayoutReport({ operatorId: opBId })).map((p) => p.payoutId);
    expect(bIds).toContain(opBPayoutId);
  });
});
