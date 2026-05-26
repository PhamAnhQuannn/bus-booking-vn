import { PrismaClient, TripStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { addDays, startOfDay, set } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { hash as hashPassword } from '../lib/auth/password';
import { normalizePhone } from '../lib/auth/phoneNormalize';

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

  // Route children (PickupPoint Cascade, RecurringTripTemplate no cascade) and
  // Bus children (BusMaintenance Cascade) precede their parents.
  await prisma.pickupPoint.deleteMany();
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
  const op1 = await prisma.operator.create({
    data: {
      legalName: 'Công ty TNHH Xe Khách Phương Bắc',
      contactPhone: '+8490xxxxxx1',
      contactEmail: 'lienhe@phuongbac.vn',
    },
  });

  const op2 = await prisma.operator.create({
    data: {
      legalName: 'Công ty CP Vận Tải Miền Nam',
      contactPhone: '+8490xxxxxx2',
      contactEmail: 'hotro@mientam.vn',
    },
  });

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
  ]);

  // ---- Routes ----
  const r1 = await prisma.route.create({ data: { origin: 'Hà Nội', destination: 'TP.HCM', operatorId: op1.id, durationMinutes: 960 } });
  const r2 = await prisma.route.create({ data: { origin: 'Đà Nẵng', destination: 'Huế', operatorId: op1.id, durationMinutes: 120 } });
  const r3 = await prisma.route.create({ data: { origin: 'Cần Thơ', destination: 'Đà Lạt', operatorId: op2.id, durationMinutes: 300 } });
  // Dedicated route for e2e race-condition test (capacity-1 bus, AC-4)
  const rRace = await prisma.route.create({ data: { origin: 'E2E Race Origin', destination: 'E2E Race Destination', operatorId: op1.id, durationMinutes: 240 } });

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
    // Route 1: Hà Nội → TP.HCM (scheduled, various prices)
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

  for (const trip of tripData) {
    await prisma.trip.create({ data: trip });
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
      phone: normalizePhone('0901230001'),
      contactPhone: '+8490xxxxxx2',
      notificationPhone: '+8490xxxxxx3',
      passwordHash: seedOpHash,
      requiresPasswordChange: true,
      displayName: 'Seed Operator Admin',
      role: 'admin',
    },
  });

  console.log(
    `Seeded: 2 operators, 6 buses, 4 routes, ${tripData.length} trips (mix of statuses for AC-3; capacity-1 trip for AC-4 race test). 1 OperatorUser (Issue 010).`
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
