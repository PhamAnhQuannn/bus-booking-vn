import { PrismaClient, TripStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { addDays, startOfDay, set } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { hash as hashPassword } from '../lib/auth/password';
import { normalizePhone } from '../lib/core/validation/phone';
import { listProvinces, listDistricts, listWards, resolveLabel } from '../lib/geo/vnAdmin';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TZ = 'Asia/Ho_Chi_Minh';

/**
 * Convert a wall-clock time in Asia/Ho_Chi_Minh to a UTC Date.
 * @param date  Base date (UTC Date object, but we interpret it as VN date)
 * @param hours Hour in VN time
 * @param minutes Minute in VN time
 */
function vnTime(baseUtcDate: Date, hours: number, minutes = 0): Date {
  // Get VN "today" at midnight
  const vnDate = toZonedTime(baseUtcDate, TZ);
  const vnWithTime = set(vnDate, { hours, minutes, seconds: 0, milliseconds: 0 });
  return fromZonedTime(vnWithTime, TZ);
}

async function main() {
  console.log('Seeding database...');

  // Clear existing data (safe for CI fresh-boot), FK-ordered children-first.
  // Booking.holdId → Hold is onDelete:Restrict, so Booking MUST be deleted
  // before Hold (deleting Hold first while an e2e Booking references it throws
  // Booking_holdId_fkey). PaymentEvent → Booking has no cascade, so it precedes
  // Booking. NotificationLog → Booking is Cascade but we delete explicitly to
  // avoid relying on cascade ordering.
  await prisma.notificationLog.deleteMany();
  await prisma.paymentEvent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.hold.deleteMany();

  // Trip children without cascade (or SetNull) must precede Trip.
  // RecurringGenerationLog.tripId → SetNull; Payout.tripId → Trip; and
  // OperatorUser.assignedTripId ("StaffAssignment", no cascade) must be NULLed
  // before any Trip can be deleted.
  await prisma.recurringGenerationLog.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.operatorUser.updateMany({ data: { assignedTripId: null } });
  await prisma.trip.deleteMany();

  // Route children (RecurringTripTemplate no cascade) and Bus children
  // (BusMaintenance Cascade) precede their parents. (TripPickupArea cascades from
  // Trip; OperatorPickupArea cascades from Operator — handled below.)
  await prisma.recurringTripTemplate.deleteMany();
  await prisma.route.deleteMany();
  await prisma.busMaintenance.deleteMany();
  await prisma.bus.deleteMany();

  // Operator-scoped auth/session rows. OperatorSession cascades from
  // OperatorUser; OperatorOtpAttempt has no FK. OperatorUser → Operator has no
  // cascade, so OperatorUser precedes Operator.
  await prisma.operatorOtpAttempt.deleteMany();
  await prisma.operatorSession.deleteMany();
  await prisma.operatorUser.deleteMany();
  await prisma.operator.deleteMany();

  // Customer-scoped rows (customer e2e specs leave these behind).
  // Session → Customer Cascade; Booking.customerId → SetNull (Bookings already
  // deleted above). OtpAttempt has no FK.
  await prisma.session.deleteMany();
  await prisma.otpAttempt.deleteMany();
  await prisma.customer.deleteMany();

  // ---- Operators ----
  // NOTE: Phone numbers use placeholder values — NEVER real VN mobile numbers
  // Issue 045: seeded demo operators are APPROVED so their trips are searchable
  // (default status is PENDING_REVIEW, which the Issue 046 search gate hides).
  const op1 = await prisma.operator.create({
    data: {
      legalName: 'Công ty TNHH Xe Khách Phương Bắc',
      brandName: 'Phương Bắc',
      contactName: 'Nguyễn Văn A',
      address: 'Hà Nội',
      routesSummary: 'Hà Nội – Sài Gòn',
      contactPhone: '+8490xxxxxx1',
      contactEmail: 'lienhe@phuongbac.vn',
      status: 'APPROVED',
    },
  });

  const op2 = await prisma.operator.create({
    data: {
      legalName: 'Công ty CP Vận Tải Miền Nam',
      brandName: 'Miền Nam',
      contactName: 'Trần Thị B',
      address: 'TP. Hồ Chí Minh',
      routesSummary: 'Sài Gòn – Đà Lạt',
      contactPhone: '+8490xxxxxx2',
      contactEmail: 'hotro@mientam.vn',
      status: 'APPROVED',
    },
  });

  const op3 = await prisma.operator.create({
    data: {
      legalName: 'Công ty TNHH Vận Tải Tây Nguyên',
      brandName: 'Tây Nguyên',
      contactName: 'Lê Văn C',
      address: 'Đắk Lắk',
      routesSummary: 'Buôn Ma Thuột – Sài Gòn',
      contactPhone: '+8490xxxxxx4',
      contactEmail: 'cskh@taynguyen.vn',
      status: 'APPROVED',
    },
  });

  // ---- Operator pickup areas (Issue 105/106) ----
  // Seed each operator's reusable menu (a few real huyện/xã from the vnAdmin
  // dataset) + set their base province, so trips can expose pickup destinations.
  async function seedOperatorAreas(operatorId: string, provinceName: string) {
    const province = listProvinces().find((p) => p.name.includes(provinceName));
    if (!province) return [] as { id: string; label: string }[];
    const district = listDistricts(province.code)[0];
    if (!district) return [];
    const wards = listWards(district.code).slice(0, 3);
    await prisma.operator.update({
      where: { id: operatorId },
      data: { provinceCode: province.code, provinceName: province.name },
    });
    const created: { id: string; label: string }[] = [];
    let order = 1;
    for (const w of wards) {
      const label =
        resolveLabel({ provinceCode: province.code, districtCode: district.code, wardCode: w.code }) ??
        `${w.name}, ${district.name}, ${province.name}`;
      // Named point: a concrete stop inside the ward + an address line.
      const name = `Văn phòng ${w.name}`;
      const addressLine = `Số ${order} đường ${district.name}`;
      const row = await prisma.operatorPickupArea.create({
        data: {
          operatorId,
          provinceCode: province.code,
          districtCode: district.code,
          districtName: district.name,
          wardCode: w.code,
          wardName: w.name,
          name,
          addressLine,
          label,
          displayOrder: order++,
        },
        select: { id: true },
      });
      // The customer-facing snapshot is the point identity (name — address), not the ward label.
      created.push({ id: row.id, label: `${name} — ${addressLine}` });
    }
    return created;
  }

  const areasByOperator: Record<string, { id: string; label: string }[]> = {
    [op1.id]: await seedOperatorAreas(op1.id, 'Hà Nội'),
    [op2.id]: await seedOperatorAreas(op2.id, 'Hồ Chí Minh'),
    [op3.id]: await seedOperatorAreas(op3.id, 'Đắk Lắk'),
  };

  // ---- Buses ----
  const buses = await Promise.all([
    prisma.bus.create({ data: { operatorId: op1.id, capacity: 40, licensePlate: '29B-12345', busType: 'coach' } }),
    prisma.bus.create({ data: { operatorId: op1.id, capacity: 40, licensePlate: '29B-12346', busType: 'coach' } }),
    prisma.bus.create({
      data: {
        operatorId: op1.id,
        capacity: 40,
        licensePlate: '29B-12347',
        busType: 'coach',
        maintenanceStart: new Date(),
        maintenanceEnd: addDays(new Date(), 3),
      },
    }), // Under maintenance
    prisma.bus.create({ data: { operatorId: op2.id, capacity: 40, licensePlate: '51B-99001', busType: 'coach' } }),
    prisma.bus.create({ data: { operatorId: op2.id, capacity: 40, licensePlate: '51B-99002', busType: 'coach' } }),
    // Capacity-1 bus dedicated for e2e race-condition test (AC-4)
    prisma.bus.create({ data: { operatorId: op1.id, capacity: 1, licensePlate: 'E2E-RACE-01', busType: 'coach' } }),
    // --- Variety buses (indices 6+) for the new filters; indices 0–5 above stay stable ---
    prisma.bus.create({ data: { operatorId: op1.id, capacity: 34, licensePlate: '29B-22001', busType: 'sleeper' } }),    // 6
    prisma.bus.create({ data: { operatorId: op1.id, capacity: 22, licensePlate: '29B-22002', busType: 'limousine' } }),  // 7
    prisma.bus.create({ data: { operatorId: op2.id, capacity: 45, licensePlate: '51B-99003', busType: 'coach' } }),      // 8
    prisma.bus.create({ data: { operatorId: op2.id, capacity: 34, licensePlate: '51B-99004', busType: 'sleeper' } }),    // 9
    prisma.bus.create({ data: { operatorId: op2.id, capacity: 22, licensePlate: '51B-99005', busType: 'limousine' } }),  // 10
    prisma.bus.create({ data: { operatorId: op3.id, capacity: 40, licensePlate: '47B-30001', busType: 'coach' } }),      // 11
    prisma.bus.create({ data: { operatorId: op3.id, capacity: 34, licensePlate: '47B-30002', busType: 'sleeper' } }),    // 12
    prisma.bus.create({ data: { operatorId: op3.id, capacity: 22, licensePlate: '47B-30003', busType: 'limousine' } }),  // 13
  ]);

  // ---- Routes ----
  const r1 = await prisma.route.create({ data: { origin: 'Hà Nội', destination: 'Sài Gòn', operatorId: op1.id, durationMinutes: 960 } });
  const r2 = await prisma.route.create({ data: { origin: 'Đà Nẵng', destination: 'Huế', operatorId: op1.id, durationMinutes: 120 } });
  const r3 = await prisma.route.create({ data: { origin: 'Cần Thơ', destination: 'Đà Lạt', operatorId: op2.id, durationMinutes: 300 } });
  // --- Additional real routes for the new /routes + search-filter surfaces ---
  const r4 = await prisma.route.create({ data: { origin: 'Hà Nội', destination: 'Sa Pa', operatorId: op1.id, durationMinutes: 330 } });
  const r5 = await prisma.route.create({ data: { origin: 'Hà Nội', destination: 'Hải Phòng', operatorId: op2.id, durationMinutes: 150 } });
  const r6 = await prisma.route.create({ data: { origin: 'Sài Gòn', destination: 'Đà Lạt', operatorId: op2.id, durationMinutes: 360 } });
  const r7 = await prisma.route.create({ data: { origin: 'Huế', destination: 'Đà Nẵng', operatorId: op3.id, durationMinutes: 120 } });
  const r8 = await prisma.route.create({ data: { origin: 'Nha Trang', destination: 'Đà Lạt', operatorId: op3.id, durationMinutes: 240 } });
  // Same origin/destination as r6 but a different operator → /routes shows "2 nhà xe".
  const r9 = await prisma.route.create({ data: { origin: 'Sài Gòn', destination: 'Đà Lạt', operatorId: op3.id, durationMinutes: 360 } });
  // Dedicated route for e2e race-condition test (capacity-1 bus, AC-4)
  const rRace = await prisma.route.create({ data: { origin: 'E2E Race Origin', destination: 'E2E Race Destination', operatorId: op1.id, durationMinutes: 240 } });

  // --- Popular landing-page routes (RouteDirectory + carousels) so those links
  //     return real results. Names match the UI exactly — canonical "Sài Gòn" (no "TP.HCM" split).
  //     Spread across operators — each has coach/sleeper/limousine buses for the dense generator. ---
  const extraRouteDefs: Array<{ origin: string; destination: string; operatorId: string; durationMinutes: number }> = [
    { origin: 'Hà Nội', destination: 'Sài Gòn', operatorId: op1.id, durationMinutes: 1740 },
    { origin: 'Sài Gòn', destination: 'Hà Nội', operatorId: op2.id, durationMinutes: 1740 },
    { origin: 'Thanh Hóa', destination: 'Sài Gòn', operatorId: op1.id, durationMinutes: 1500 },
    { origin: 'Đà Lạt', destination: 'Sài Gòn', operatorId: op3.id, durationMinutes: 360 },
    { origin: 'Sài Gòn', destination: 'Nha Trang', operatorId: op2.id, durationMinutes: 480 },
    { origin: 'Sài Gòn', destination: 'Vũng Tàu', operatorId: op2.id, durationMinutes: 150 },
    { origin: 'Sài Gòn', destination: 'Cần Thơ', operatorId: op2.id, durationMinutes: 210 },
    { origin: 'Sài Gòn', destination: 'Đà Nẵng', operatorId: op2.id, durationMinutes: 960 },
    { origin: 'Sài Gòn', destination: 'Bình Dương', operatorId: op2.id, durationMinutes: 60 },
    { origin: 'Hà Nội', destination: 'Đà Nẵng', operatorId: op1.id, durationMinutes: 900 },
    { origin: 'Hà Nội', destination: 'Thanh Hóa', operatorId: op1.id, durationMinutes: 180 },
    { origin: 'Hà Nội', destination: 'Vinh', operatorId: op1.id, durationMinutes: 300 },
  ];
  const extraRoutes = await Promise.all(extraRouteDefs.map((d) => prisma.route.create({ data: d })));

  // --- Bidirectional fill: every real route searchable both ways. Derive the reverse
  //     of each real route; skip pairs already bidirectional (Đà Nẵng↔Huế, Sài Gòn↔Đà Lạt,
  //     Hà Nội↔Sài Gòn) + r1 (now Hà Nội→Sài Gòn, already covered) / e2e fixture (rRace). Reverse keeps the
  //     same duration (symmetric) + operator. ---
  const baseRealRoutes = [r2, r3, r4, r5, r6, r7, r8, r9, ...extraRoutes];
  const existingKeys = new Set(baseRealRoutes.map((r) => `${r.origin}|${r.destination}`));
  const seenReverse = new Set<string>();
  const reverseDefs: Array<{ origin: string; destination: string; operatorId: string; durationMinutes: number }> = [];
  for (const r of baseRealRoutes) {
    const revKey = `${r.destination}|${r.origin}`;
    if (existingKeys.has(revKey) || seenReverse.has(revKey)) continue;
    seenReverse.add(revKey);
    reverseDefs.push({ origin: r.destination, destination: r.origin, operatorId: r.operatorId, durationMinutes: r.durationMinutes });
  }
  const reverseRoutes = await Promise.all(reverseDefs.map((d) => prisma.route.create({ data: d })));

  // ---- Route-scoped pickup areas (Issue 113) ----
  // Pickup areas are route-scoped: assign each operator's full menu to every one of
  // that operator's routes so a fresh seed has populated new-trip pickers per route.
  const allRoutesForPickup = await prisma.route.findMany({ select: { id: true, operatorId: true } });
  for (const r of allRoutesForPickup) {
    const areas = areasByOperator[r.operatorId] ?? [];
    if (areas.length === 0) continue;
    await prisma.routePickupArea.createMany({
      data: areas.map((a, i) => ({ routeId: r.id, operatorPickupAreaId: a.id, displayOrder: i })),
      skipDuplicates: true,
    });
  }

  // ---- Places (Issue 044) ----
  // Canonical Place per distinct trimmed origin/destination, then link route FKs.
  // Mirrors the place_entity migration backfill so a fresh seed is place-linked.
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Place" ("id", "canonicalName", "aliases", "createdAt")
    SELECT gen_random_uuid()::text, n, ARRAY[]::text[], CURRENT_TIMESTAMP
    FROM (
      SELECT DISTINCT btrim(origin) AS n FROM "Route" WHERE btrim(origin) <> ''
      UNION
      SELECT DISTINCT btrim(destination) AS n FROM "Route" WHERE btrim(destination) <> ''
    ) AS names
    WHERE NOT EXISTS (
      SELECT 1 FROM "Place" p WHERE lower(p."canonicalName") = lower(n)
    );
  `);
  await prisma.$executeRawUnsafe(
    `UPDATE "Route" r SET "originPlaceId" = p."id" FROM "Place" p WHERE p."canonicalName" = btrim(r.origin);`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Route" r SET "destPlaceId" = p."id" FROM "Place" p WHERE p."canonicalName" = btrim(r.destination);`
  );

  // Pickup areas (OperatorPickupArea + per-trip TripPickupArea) are seeded by the
  // pickup-feature slices (issues 105/106); the legacy route-scoped PickupPoint seed
  // was removed in issue 104.

  // ---- Trips ----
  // today in VN time
  const now = new Date();
  const todayStart = startOfDay(toZonedTime(now, TZ));

  const tripData: Array<{
    routeId: string;
    busId: string;
    operatorId: string;
    departureAt: Date;
    price: number;
    status: TripStatus;
    salesClosed: boolean;
  }> = [
    // Route 1: Hà Nội → Sài Gòn (scheduled, various prices)
    {
      routeId: r1.id,
      busId: buses[0].id,
      operatorId: op1.id,
      departureAt: vnTime(addDays(todayStart, 0), 6, 0),
      price: 250000,
      status: 'scheduled',
      salesClosed: false,
    },
    {
      routeId: r1.id,
      busId: buses[0].id,
      operatorId: op1.id,
      departureAt: vnTime(addDays(todayStart, 1), 8, 30),
      price: 270000,
      status: 'scheduled',
      salesClosed: false,
    },
    {
      routeId: r1.id,
      busId: buses[1].id,
      operatorId: op1.id,
      departureAt: vnTime(addDays(todayStart, 2), 14, 0),
      price: 300000,
      status: 'scheduled',
      salesClosed: false,
    },
    {
      routeId: r1.id,
      busId: buses[1].id,
      operatorId: op1.id,
      departureAt: vnTime(addDays(todayStart, 3), 20, 0),
      price: 280000,
      status: 'scheduled',
      salesClosed: false,
    },
    // AC-3 coverage: cancelled trip
    {
      routeId: r1.id,
      busId: buses[0].id,
      operatorId: op1.id,
      departureAt: vnTime(addDays(todayStart, 4), 10, 0),
      price: 260000,
      status: 'cancelled',
      salesClosed: false,
    },
    // AC-3 coverage: salesClosed trip
    {
      routeId: r1.id,
      busId: buses[1].id,
      operatorId: op1.id,
      departureAt: vnTime(addDays(todayStart, 5), 12, 0),
      price: 290000,
      status: 'scheduled',
      salesClosed: true,
    },
    // Route 2: Đà Nẵng → Huế
    {
      routeId: r2.id,
      busId: buses[3].id,
      operatorId: op1.id,
      departureAt: vnTime(addDays(todayStart, 1), 7, 0),
      price: 200000,
      status: 'scheduled',
      salesClosed: false,
    },
    // AC-3 coverage: maintenance-bus trip (buses[2] is under maintenance now..+3 days)
    // Tomorrow 11am falls inside the maintenance window — must be excluded by search.
    {
      routeId: r2.id,
      busId: buses[2].id,
      operatorId: op1.id,
      departureAt: vnTime(addDays(todayStart, 1), 11, 0),
      price: 220000,
      status: 'scheduled',
      salesClosed: false,
    },
    {
      routeId: r2.id,
      busId: buses[3].id,
      operatorId: op1.id,
      departureAt: vnTime(addDays(todayStart, 2), 13, 0),
      price: 210000,
      status: 'scheduled',
      salesClosed: false,
    },
    // Route 3: Cần Thơ → Đà Lạt
    {
      routeId: r3.id,
      busId: buses[4].id,
      operatorId: op2.id,
      departureAt: vnTime(addDays(todayStart, 1), 9, 0),
      price: 350000,
      status: 'scheduled',
      salesClosed: false,
    },
    {
      routeId: r3.id,
      busId: buses[4].id,
      operatorId: op2.id,
      departureAt: vnTime(addDays(todayStart, 7), 15, 0),
      price: 340000,
      status: 'scheduled',
      salesClosed: false,
    },
    // AC-4 race-condition e2e trip: capacity-1 bus, departs tomorrow at 06:00
    {
      routeId: rRace.id,
      busId: buses[5].id,
      operatorId: op1.id,
      departureAt: vnTime(addDays(todayStart, 1), 6, 0),
      price: 100000,
      status: 'scheduled',
      salesClosed: false,
    },
  ];

  // ---- Generated demo trips ----
  // Dense + deterministic: EVERY real route gets 3 trips EVERY day for the next 14
  // days — one per bus type (coach/sleeper/limousine) at 3 rotating windows. This
  // guarantees any upcoming (origin, destination, date) search returns several trips
  // with real busType/window/price variety for the filter UI. (The earlier sparse
  // 40-trip round-robin left most route+date combos empty.)
  // One bus per distinct type per operator (clean buses; excludes maintenance + race).
  const busByOpType: Record<string, { id: string; type: 'coach' | 'sleeper' | 'limousine' }[]> = {
    [op1.id]: [
      { id: buses[0].id, type: 'coach' },
      { id: buses[6].id, type: 'sleeper' },
      { id: buses[7].id, type: 'limousine' },
    ],
    [op2.id]: [
      { id: buses[3].id, type: 'coach' },
      { id: buses[9].id, type: 'sleeper' },
      { id: buses[10].id, type: 'limousine' },
    ],
    [op3.id]: [
      { id: buses[11].id, type: 'coach' },
      { id: buses[12].id, type: 'sleeper' },
      { id: buses[13].id, type: 'limousine' },
    ],
  };
  const realRoutes = [r1, r2, r3, r4, r5, r6, r7, r8, r9, ...extraRoutes, ...reverseRoutes];
  const windows = [
    { h: 7, m: 0 },
    { h: 13, m: 30 },
    { h: 19, m: 0 },
    { h: 23, m: 30 },
  ];
  const TYPE_PREMIUM = { coach: 0, sleeper: 60000, limousine: 120000 } as const;
  const DAYS = 14;

  for (const route of realRoutes) {
    const pool = busByOpType[route.operatorId];
    for (let day = 0; day < DAYS; day++) {
      for (let k = 0; k < pool.length; k++) {
        const bus = pool[k];
        // Rotate window start by day so all 4 windows appear across the span and a
        // single day still shows 3 distinct departure times.
        const w = windows[(day + k) % windows.length];
        const departureAt = vnTime(addDays(todayStart, day), w.h, w.m);
        const price =
          Math.round(
            (60000 + route.durationMinutes * 600 + TYPE_PREMIUM[bus.type] + (day % 4) * 7000) / 1000
          ) * 1000;
        tripData.push({
          routeId: route.id,
          busId: bus.id,
          operatorId: route.operatorId,
          departureAt,
          price,
          status: 'scheduled',
          salesClosed: false,
        });
      }
    }
  }

  await prisma.trip.createMany({ data: tripData });

  // ---- Per-trip pickup areas (Issue 106) ----
  // Link every seeded trip to its operator's pickup-area menu (snapshot label),
  // so the booking flow shows real huyện/xã pickup options.
  const seededTrips = await prisma.trip.findMany({ select: { id: true, operatorId: true } });
  const tripAreaData = seededTrips.flatMap((trip) =>
    (areasByOperator[trip.operatorId] ?? []).map((a, i) => ({
      tripId: trip.id,
      operatorPickupAreaId: a.id,
      label: a.label,
      displayOrder: i,
    }))
  );
  if (tripAreaData.length > 0) {
    await prisma.tripPickupArea.createMany({ data: tripAreaData });
  }

  // ---- OperatorUser (Issue 010) ----
  // NOTE: contact/notification phones use literal-x mask — NEVER real VN numbers
  // (AGENTS.md: PII placeholders must escape the gitleaks +84 regex). The LOGIN
  // identity `phone` must be a normalize-able VN number or the seeded operator can
  // never authenticate; we derive it at runtime from a gitleaks-safe local literal
  // (no +84 prefix) so the stored value is the valid E.164 form +84901230001.
  const seedOpHash = await hashPassword('BBOp2026!');
  await prisma.operatorUser.create({
    data: {
      operatorId: op1.id,
      // 2026-06-06: login key is username (BRAND_ACRONYM-last4phone), not phone.
      username: 'PB-0001',
      phone: normalizePhone('0901230001'),
      contactPhone: '+8490xxxxxx2',
      notificationPhone: '+8490xxxxxx3',
      passwordHash: seedOpHash,
      // Dev seed: ready-to-test account (no forced first-login password change).
      requiresPasswordChange: false,
      displayName: 'Seed Operator Admin',
      role: 'admin',
    },
  });

  // Issue 048: global 6% platform-fee cutover row (ratePpm 60000 = 6%),
  // effective from far in the past so it covers every existing date. Mirrors the
  // row seeded inside migration 20260602030000_fee_config. Idempotent: only
  // insert when no global (operatorId NULL) row already exists, so re-running
  // db:seed on a migrated DB does not duplicate the cutover row.
  const existingGlobalFee = await prisma.feeConfig.findFirst({
    where: { operatorId: null },
    select: { id: true },
  });
  if (!existingGlobalFee) {
    await prisma.feeConfig.create({
      data: {
        operatorId: null,
        ratePpm: 60000,
        effectiveFrom: new Date('2020-01-01T00:00:00Z'),
        createdBy: 'system:cutover',
      },
    });
  }

  console.log(
    `Seeded: 3 operators, 14 buses (coach/sleeper/limousine), ${realRoutes.length + 1} routes ` +
      `(${realRoutes.length} real incl. ${reverseRoutes.length} reverse + 1 e2e), ${tripData.length} trips ` +
      `(12 curated for AC-3/AC-4 + ${realRoutes.length} routes × ${DAYS} days × 3 types dense demo grid). ` +
      `1 OperatorUser (Issue 010).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
