import { PrismaClient, TripStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { addDays, startOfDay, set } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { hash as hashPassword } from '../lib/auth/password';
import { normalizePhone } from '../lib/core/validation/phone';


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

// ---- Real single-operator corridor (mirrors scripts/onboard/onboardToanKhuyen.ts) ----
// Dev seed now models the ONE physical route we operate — Thanh Hóa ↔ Sài Gòn — so
// localhost matches prod (landing hero shows exactly the two directions we run), instead
// of the old ~13-city demo grid. Constants copied from the onboard script so the Place
// aliases + boarding points stay identical to the real operator.
const NORTH = 'Thanh Hóa';
const SOUTH = 'Sài Gòn';

interface PlaceSeed {
  canonicalName: string;
  slug: string;
  aliases: string[];
}
const PLACE_NORTH: PlaceSeed = {
  canonicalName: NORTH,
  slug: 'thanh-hoa',
  aliases: ['Thanh Hoa', 'Triệu Sơn', 'Đông Sơn', 'Nông Cống', 'Bến Sung', 'Thọ Xuân', 'Ngọc Lặc'],
};
const PLACE_SOUTH: PlaceSeed = {
  canonicalName: SOUTH,
  slug: 'sai-gon',
  aliases: [
    'Sai Gon', 'TP HCM', 'TP. Hồ Chí Minh', 'Hồ Chí Minh', 'Ho Chi Minh',
    'Bàu Bàng', 'Chợ Tân Khai', 'Chơn Thành', 'Bến Cát', 'Mỹ Phước',
    'Sóng Thần', 'Dĩ An', 'Tân Đông Hiệp', 'An Phú',
    'Ngã tư Miếu Ông Cù', 'Ngã tư 550',
  ],
};
// Display-only boarding schedule per direction — one bus, staggered pickups (NOT separate trips).
const BOARDING_NORTH = [
  { point: 'Triệu Sơn', time: '06:00' },
  { point: 'Đông Sơn', time: '06:00' },
  { point: 'Nông Cống', time: '07:00' },
  { point: 'Bến Sung', time: '08:00' },
];
const BOARDING_SOUTH = [
  { point: 'Chợ Tân Khai', time: '03:00' },
  { point: 'Chơn Thành', time: '03:30' },
  { point: 'Bàu Bàng', time: '04:00' },
  { point: 'Bến Cát', time: '04:30' },
  { point: 'Mỹ Phước', time: '04:30' },
  { point: 'Ngã tư Miếu Ông Cù', time: '05:00' },
  { point: 'An Phú', time: '05:30' },
  { point: 'Tân Đông Hiệp', time: '05:30' },
  { point: 'Ngã tư 550', time: '06:00' },
  { point: 'Sóng Thần', time: '06:00' },
];

// Place is a GLOBAL shared registry — MERGE (union) aliases with any already present,
// never overwrite. Mirrors upsertPlace in the onboard script.
async function upsertPlace(p: PlaceSeed): Promise<string> {
  const existing = await prisma.place.findUnique({ where: { slug: p.slug }, select: { aliases: true } });
  const mergedAliases = [...new Set([...(existing?.aliases ?? []), ...p.aliases])];
  const row = await prisma.place.upsert({
    where: { slug: p.slug },
    update: { canonicalName: p.canonicalName, aliases: mergedAliases },
    create: { canonicalName: p.canonicalName, slug: p.slug, aliases: mergedAliases },
    select: { id: true },
  });
  return row.id;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to seed: NODE_ENV=production. prisma/seed.ts contains dev fixtures ' +
        '(including the weak operator password BBOp2026!) and must never run against a production DB.',
    );
  }

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
  // (BusMaintenance Cascade) precede their parents.
  await prisma.recurringTripTemplate.deleteMany();
  await prisma.route.deleteMany();
  // Place has no cascade; wipe after routes so a reseed without DROP SCHEMA leaves no
  // stale demo cities behind (typeahead + registry stay in sync with the one corridor).
  await prisma.place.deleteMany();
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
      legalName: 'Toàn Khuyên – Minh Tuyến',
      brandName: 'Toàn Khuyên – Minh Tuyến',
      contactName: 'Toàn',
      address: 'Thanh Hóa',
      routesSummary: 'Thanh Hóa – Sài Gòn',
      contactPhone: '+8490xxxxxx1',
      contactEmail: 'ops@toankhuyen.vn',
      status: 'APPROVED',
    },
  });

  // ---- Buses ----
  // One physical sleeper (the corridor bus) + a capacity-1 bus reserved for the e2e
  // race-condition fixture (AC-4). No demo variety fleet — prod runs a single sleeper.
  const buses = await Promise.all([
    prisma.bus.create({ data: { operatorId: op1.id, capacity: 40, licensePlate: '36B-12345', busType: 'sleeper' } }), // 0: corridor bus
    // Capacity-1 bus dedicated for e2e race-condition test (AC-4)
    prisma.bus.create({ data: { operatorId: op1.id, capacity: 1, licensePlate: 'E2E-RACE-01', busType: 'coach' } }),   // 1: AC-4 race
  ]);

  // ---- Places + Routes ----
  // The one real corridor: Thanh Hóa ↔ Sài Gòn (both directions), plus the hidden e2e
  // race fixture. Rich Places (with boarding-town aliases) so "Nông Cống → Sài Gòn"
  // resolves to the physical trip — identical to the prod onboard script.
  const northId = await upsertPlace(PLACE_NORTH);
  const southId = await upsertPlace(PLACE_SOUTH);

  const routeBn = await prisma.route.create({
    data: {
      operatorId: op1.id,
      origin: NORTH,
      destination: SOUTH,
      durationMinutes: 1920,
      originPlaceId: northId,
      destPlaceId: southId,
      boardingSchedule: BOARDING_NORTH,
    },
  });
  const routeNb = await prisma.route.create({
    data: {
      operatorId: op1.id,
      origin: SOUTH,
      destination: NORTH,
      durationMinutes: 1920,
      originPlaceId: southId,
      destPlaceId: northId,
      boardingSchedule: BOARDING_SOUTH,
    },
  });
  // Dedicated route for e2e race-condition test (capacity-1 bus, AC-4). moderatedAt is set
  // so it is HIDDEN from getActiveRoutes + public search (both filter moderatedAt IS NULL);
  // the race spec reaches its trip via a direct DB lookup, not the search API.
  const rRace = await prisma.route.create({ data: { origin: 'E2E Race Origin', destination: 'E2E Race Destination', operatorId: op1.id, durationMinutes: 240, moderatedAt: new Date() } });

  // ---- Places (Issue 044) ----
  // Canonical Place per distinct trimmed origin/destination, then link route FKs.
  // Mirrors the place_entity migration backfill so a fresh seed is place-linked.
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Place" ("id", "canonicalName", "aliases", "slug", "createdAt")
    SELECT gen_random_uuid()::text, n, ARRAY[]::text[],
      regexp_replace(
        regexp_replace(
          lower(unaccent_immutable(translate(n, 'đĐ', 'dd'))),
          '[^a-z0-9]+', '-', 'g'
        ),
        '^-+|-+$', '', 'g'
      ),
      CURRENT_TIMESTAMP
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
  }> = [];

  // Dense + deterministic: BOTH directions of the corridor get one 06:00 sleeper trip
  // every day for the next 14 days, so any upcoming search (esp. tomorrow, the default)
  // returns a bookable trip. Flat 850k fare — matches the real operator's card.
  const DAYS = 14;
  const FARE = 850000;
  for (const route of [routeBn, routeNb]) {
    for (let day = 0; day < DAYS; day++) {
      tripData.push({
        routeId: route.id,
        busId: buses[0].id,
        operatorId: op1.id,
        departureAt: vnTime(addDays(todayStart, day), 6, 0),
        price: FARE,
        status: 'scheduled',
        salesClosed: false,
      });
    }
  }

  // AC-4 race-condition e2e trip: capacity-1 bus, departs tomorrow at 06:00 (hidden route).
  tripData.push({
    routeId: rRace.id,
    busId: buses[1].id,
    operatorId: op1.id,
    departureAt: vnTime(addDays(todayStart, 1), 6, 0),
    price: 100000,
    status: 'scheduled',
    salesClosed: false,
  });

  await prisma.trip.createMany({ data: tripData });

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
    `Seeded: 1 operator (Toàn Khuyên – Minh Tuyến), 2 buses (1 sleeper + 1 e2e race), ` +
      `3 routes (Thanh Hóa↔Sài Gòn bidirectional + 1 hidden e2e), ${tripData.length} trips ` +
      `(2 dirs × ${DAYS} days @ 06:00 + 1 AC-4 race). 1 OperatorUser (PB-0001, Issue 010).`
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
