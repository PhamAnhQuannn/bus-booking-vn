import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';

let opAId: string;
let opBId: string;
let opBBusId: string;
let opBRouteId: string;
let opBTripId: string;

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
  });

  afterAll(async () => {
    // Clean up in reverse FK order
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
});
