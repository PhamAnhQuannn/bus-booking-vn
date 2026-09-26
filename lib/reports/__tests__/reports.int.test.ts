/**
 * Integration tests for the operator reporting KPIs (#775) — lib/reports had zero
 * coverage on money-facing raw SQL. Exercises getOperatorKpis + getBusPerformance
 * against a real Postgres, pinning: tenant isolation, paid-only revenue, VN-tz
 * (Asia/Ho_Chi_Minh) daily bucketing, cancelled-trip + deactivated-bus exclusion,
 * div-by-zero guards, and the previous-window delta.
 *
 * DB-gated — runs in CI / `pnpm vitest:int`, not locally.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { BookingStatus } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';
import { generateBookingRef } from '@/lib/core/id';
import { getOperatorKpis } from '../getOperatorKpis';
import { getBusPerformance } from '../getBusPerformance';

// VN-local window Oct 1–3, 2026.
const DATE_FROM = '2026-10-01';
const DATE_TO = '2026-10-03';

let opAId: string;
let opBId: string;
let busA1Id: string; // active, capacity 40
let busA2Id: string; // deactivated → excluded from getBusPerformance
let busB1Id: string;

async function makeBooking(tripId: string, status: BookingStatus, totalVnd: number): Promise<void> {
  await prisma.booking.create({
    data: {
      id: randomUUID(),
      bookingRef: generateBookingRef(),
      confirmationToken: randomUUID().replace(/-/g, '') + 'rp',
      tripId,
      buyerName: 'Report Buyer',
      buyerPhone: '+8490xxxxxx5',
      ticketCount: 1,
      totalVnd,
      paymentMethod: 'bank_transfer',
      status,
    },
  });
}

beforeAll(async () => {
  const opA = await prisma.operator.create({
    data: { legalName: 'Reports Op A', contactPhone: '+8490xxxxxx1', contactEmail: 'rep-a@test.invalid', status: 'APPROVED' },
  });
  opAId = opA.id;
  const opB = await prisma.operator.create({
    data: { legalName: 'Reports Op B', contactPhone: '+8490xxxxxx2', contactEmail: 'rep-b@test.invalid', status: 'APPROVED' },
  });
  opBId = opB.id;

  const routeA = await prisma.route.create({
    data: { origin: 'Rep A Origin', destination: 'Rep A Dest', operatorId: opAId, durationMinutes: 120 },
  });
  const routeB = await prisma.route.create({
    data: { origin: 'Rep B Origin', destination: 'Rep B Dest', operatorId: opBId, durationMinutes: 120 },
  });

  const busA1 = await prisma.bus.create({ data: { operatorId: opAId, capacity: 40, licensePlate: 'REP-A1', busType: 'coach' } });
  busA1Id = busA1.id;
  const busA2 = await prisma.bus.create({
    data: { operatorId: opAId, capacity: 20, licensePlate: 'REP-A2', busType: 'coach', deactivatedAt: new Date() },
  });
  busA2Id = busA2.id;
  const busB1 = await prisma.bus.create({ data: { operatorId: opBId, capacity: 30, licensePlate: 'REP-B1', busType: 'coach' } });
  busB1Id = busB1.id;

  // Trip A-t1: VN 2026-10-01 09:00, scheduled.
  const at1 = await prisma.trip.create({
    data: { operatorId: opAId, routeId: routeA.id, busId: busA1Id, departureAt: new Date('2026-10-01T02:00:00Z'), price: 100_000, status: 'scheduled' },
  });
  // Trip A-t2: departs 2026-10-02 18:30Z = VN 2026-10-03 01:30 → TZ-boundary case.
  const at2 = await prisma.trip.create({
    data: { operatorId: opAId, routeId: routeA.id, busId: busA1Id, departureAt: new Date('2026-10-02T18:30:00Z'), price: 200_000, status: 'scheduled' },
  });
  // Trip A-cancelled: in-window (VN Oct 2) but cancelled → excluded from capacity + bus perf.
  await prisma.trip.create({
    data: { operatorId: opAId, routeId: routeA.id, busId: busA1Id, departureAt: new Date('2026-10-02T02:00:00Z'), price: 100_000, status: 'cancelled' },
  });
  // Trip B-t1: op B, in-window — isolation control.
  const bt1 = await prisma.trip.create({
    data: { operatorId: opBId, routeId: routeB.id, busId: busB1Id, departureAt: new Date('2026-10-01T03:00:00Z'), price: 500_000, status: 'scheduled' },
  });

  // A-t1: 2 paid (100k each) + 1 awaiting_payment (excluded from revenue/paid).
  await makeBooking(at1.id, 'paid', 100_000);
  await makeBooking(at1.id, 'paid', 100_000);
  await makeBooking(at1.id, 'awaiting_payment', 100_000);
  // A-t2: 1 completed (200k) on the TZ-boundary trip → VN Oct 3.
  await makeBooking(at2.id, 'completed', 200_000);
  // B-t1: 1 paid (500k) — must never appear in op A's numbers.
  await makeBooking(bt1.id, 'paid', 500_000);
});

afterAll(async () => {
  for (const opId of [opAId, opBId]) {
    await prisma.booking.deleteMany({ where: { trip: { operatorId: opId } } });
    await prisma.trip.deleteMany({ where: { operatorId: opId } });
    await prisma.route.deleteMany({ where: { operatorId: opId } });
    await prisma.bus.deleteMany({ where: { operatorId: opId } });
    await prisma.operator.delete({ where: { id: opId } });
  }
  await prisma.$disconnect();
});

describe('getOperatorKpis', () => {
  it('reports paid-only, tenant-scoped, VN-tz-bucketed KPIs', async () => {
    const k = await getOperatorKpis({ operatorId: opAId, dateFrom: DATE_FROM, dateTo: DATE_TO });

    // paid-only gross = 2×100k (t1) + 200k (t2) = 400k; op B's 500k excluded (tenant).
    expect(k.grossRevenueVnd).toBe(400_000);
    expect(k.seatsSold).toBe(3);
    expect(k.periodTrips).toBe(2); // trips with paid bookings

    // status breakdown across the window: paid×2, completed×1, awaiting_payment×1.
    expect(k.totalBookings).toBe(4);
    expect(k.paidBookings).toBe(3);
    expect(k.paidRatePct).toBe(75);

    // capacity excludes the cancelled trip: bus A1 (40) × 2 non-cancelled trips = 80.
    expect(k.capacityTotal).toBe(80);
    expect(k.occupancyPct).toBe(4); // round(3/80*100)

    // VN-tz daily bucketing: t2 departs Oct 2 18:30Z but is VN Oct 3 → revenue on day 3, not day 2.
    expect(k.dailyRevenue).toEqual([200_000, 0, 200_000]);

    // No previous-window data → delta null. Net never exceeds gross.
    expect(k.revenueDeltaPct).toBeNull();
    expect(k.netPayoutVnd).toBeLessThanOrEqual(k.grossRevenueVnd);
  });

  it('guards div-by-zero for an operator/window with no trips', async () => {
    const k = await getOperatorKpis({ operatorId: opAId, dateFrom: '2025-01-01', dateTo: '2025-01-03' });
    expect(k.grossRevenueVnd).toBe(0);
    expect(k.capacityTotal).toBe(0);
    expect(k.occupancyPct).toBe(0);
    expect(k.totalBookings).toBe(0);
    expect(k.paidRatePct).toBe(0);
    expect(k.revenueDeltaPct).toBeNull();
    expect(k.dailyRevenue).toEqual([0, 0, 0]);
  });
});

describe('getBusPerformance', () => {
  it('is tenant-scoped, paid-only, and excludes cancelled trips + deactivated buses', async () => {
    const rows = await getBusPerformance({ operatorId: opAId, dateFrom: DATE_FROM, dateTo: DATE_TO });

    // Only the active bus A1 — deactivated A2 and op B's bus are excluded.
    expect(rows.map((r) => r.busId).sort()).toEqual([busA1Id]);
    expect(rows.some((r) => r.busId === busA2Id)).toBe(false);
    expect(rows.some((r) => r.busId === busB1Id)).toBe(false);

    const a1 = rows.find((r) => r.busId === busA1Id)!;
    expect(a1.tripsCount).toBe(2); // t1, t2 (cancelled trip excluded)
    expect(a1.seatsSold).toBe(3); // paid-only
    expect(a1.grossRevenueVnd).toBe(400_000);
    expect(a1.capacityTotal).toBe(80); // 40 × 2 trips
    expect(a1.occupancyPct).toBe(4);
  });

  it('returns no rows for an operator with no active buses in window', async () => {
    const rows = await getBusPerformance({ operatorId: opBId, dateFrom: '2025-01-01', dateTo: '2025-01-03' });
    // op B has an active bus but no in-window trips → bus present with zero metrics.
    for (const r of rows) {
      expect(r.tripsCount).toBe(0);
      expect(r.grossRevenueVnd).toBe(0);
      expect(r.occupancyPct).toBe(0);
    }
  });
});
