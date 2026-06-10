/**
 * Additive, idempotent trip seeder for a fixed date range.
 *
 * Seeds 3 trips/route/day (1 active bus per type per operator x rotating windows)
 * for every active route across 2026-06-07 .. 2026-06-14 (VN time, inclusive).
 *
 * Unlike prisma/seed.ts this NEVER deletes — it queries live routes + buses and
 * inserts only the trips that don't already exist in the window (LedgerEntry is
 * append-only, so a full reseed would need DROP SCHEMA). Safe to re-run.
 *
 * Run:  tsx --env-file=.env.local scripts/seed/seed-trips-range.ts
 *
 * Density + price formula mirror the dense block in prisma/seed.ts:355-413.
 */

import { PrismaClient, TripStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { addDays, set } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TZ = 'Asia/Ho_Chi_Minh';

/** Convert a wall-clock VN time to a UTC Date (verbatim from prisma/seed.ts:25-30). */
function vnTime(baseUtcDate: Date, hours: number, minutes = 0): Date {
  const vnDate = toZonedTime(baseUtcDate, TZ);
  const vnWithTime = set(vnDate, { hours, minutes, seconds: 0, milliseconds: 0 });
  return fromZonedTime(vnWithTime, TZ);
}

// ---- Range (fixed literals — never Date.now(), so reruns are deterministic) ----
const START_DATE = '2026-06-07'; // VN-local first day (inclusive)
const DAYS = 8; // 7,8,9,10,11,12,13,14 Jun

// VN midnight of START_DATE, as a UTC Date base for vnTime().
const startVnDay = fromZonedTime(`${START_DATE}T00:00:00`, TZ);

// ---- Constants (mirror prisma/seed.ts:380-386) ----
const windows = [
  { h: 7, m: 0 },
  { h: 13, m: 30 },
  { h: 19, m: 0 },
  { h: 23, m: 30 },
] as const;
const TYPE_PREMIUM = { coach: 0, sleeper: 60000, limousine: 120000 } as const;
type BusType = keyof typeof TYPE_PREMIUM;

function priceFor(durationMinutes: number, type: BusType, day: number): number {
  return (
    Math.round(
      (60000 + durationMinutes * 600 + TYPE_PREMIUM[type] + (day % 4) * 7000) / 1000
    ) * 1000
  );
}

async function main() {
  console.log(`Seeding trips ${START_DATE} for ${DAYS} days (VN)...`);

  // Active routes only (skip operator-deactivated + admin-moderated).
  const routes = await prisma.route.findMany({
    where: { deactivatedAt: null, moderatedAt: null },
    select: { id: true, operatorId: true, durationMinutes: true, origin: true, destination: true },
  });
  console.log(`Routes: ${routes.length}`);

  // Active buses, grouped operatorId -> busType -> first bus.
  const buses = await prisma.bus.findMany({
    where: { deactivatedAt: null },
    select: { id: true, operatorId: true, busType: true, maintenanceStart: true, maintenanceEnd: true },
  });
  const busByOpType = new Map<string, Map<BusType, (typeof buses)[number]>>();
  for (const b of buses) {
    const byType = busByOpType.get(b.operatorId) ?? new Map<BusType, (typeof buses)[number]>();
    if (!byType.has(b.busType as BusType)) byType.set(b.busType as BusType, b);
    busByOpType.set(b.operatorId, byType);
  }

  // Window covering the whole range, for the existing-trip dedupe query.
  const rangeStartUtc = vnTime(startVnDay, 0, 0);
  const rangeEndUtc = vnTime(addDays(startVnDay, DAYS - 1), 23, 59);
  const existing = await prisma.trip.findMany({
    where: { departureAt: { gte: rangeStartUtc, lte: rangeEndUtc } },
    select: { routeId: true, busId: true, departureAt: true },
  });
  const seen = new Set(
    existing.map((t) => `${t.routeId}|${t.busId}|${t.departureAt.toISOString()}`)
  );

  const overlapsMaintenance = (
    bus: (typeof buses)[number],
    departureAt: Date
  ): boolean => {
    if (!bus.maintenanceStart || !bus.maintenanceEnd) return false;
    return departureAt >= bus.maintenanceStart && departureAt <= bus.maintenanceEnd;
  };

  let candidates = 0;
  let skipped = 0;
  let maintenanceSkips = 0;
  const newTrips: Array<{
    routeId: string;
    busId: string;
    operatorId: string;
    departureAt: Date;
    price: number;
    status: TripStatus;
    salesClosed: boolean;
  }> = [];

  for (const route of routes) {
    const byType = busByOpType.get(route.operatorId);
    if (!byType || byType.size === 0) {
      console.warn(`! Route ${route.origin}->${route.destination} (${route.id}): operator has no active bus — skipped`);
      continue;
    }
    const typed = [...byType.values()];
    for (let day = 0; day < DAYS; day++) {
      for (let k = 0; k < typed.length; k++) {
        const bus = typed[k];
        const w = windows[(day + k) % windows.length];
        const departureAt = vnTime(addDays(startVnDay, day), w.h, w.m);
        candidates++;
        if (overlapsMaintenance(bus, departureAt)) {
          maintenanceSkips++;
          continue;
        }
        const key = `${route.id}|${bus.id}|${departureAt.toISOString()}`;
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        seen.add(key);
        newTrips.push({
          routeId: route.id,
          busId: bus.id,
          operatorId: route.operatorId,
          departureAt,
          price: priceFor(route.durationMinutes, bus.busType as BusType, day),
          status: 'scheduled',
          salesClosed: false,
        });
      }
    }
  }

  if (newTrips.length > 0) {
    await prisma.trip.createMany({ data: newTrips });
  }

  console.log(
    `Done. candidates=${candidates} existing-skipped=${skipped} maintenance-skipped=${maintenanceSkips} inserted=${newTrips.length}`
  );
}

main()
  .catch((e) => {
    console.error('Failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
