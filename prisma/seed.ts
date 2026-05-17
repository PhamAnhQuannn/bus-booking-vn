import { PrismaClient, TripStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { addDays, startOfDay, set } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

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

  // Clear existing data (safe for CI fresh-boot)
  await prisma.trip.deleteMany();
  await prisma.route.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.operator.deleteMany();

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
    prisma.bus.create({ data: { operatorId: op1.id, capacity: 40, plateNumber: '29B-12345' } }),
    prisma.bus.create({ data: { operatorId: op1.id, capacity: 40, plateNumber: '29B-12346' } }),
    prisma.bus.create({
      data: {
        operatorId: op1.id,
        capacity: 40,
        plateNumber: '29B-12347',
        maintenanceStart: new Date(),
        maintenanceEnd: addDays(new Date(), 3),
      },
    }), // Under maintenance
    prisma.bus.create({ data: { operatorId: op2.id, capacity: 40, plateNumber: '51B-99001' } }),
    prisma.bus.create({ data: { operatorId: op2.id, capacity: 40, plateNumber: '51B-99002' } }),
  ]);

  // ---- Routes ----
  const r1 = await prisma.route.create({ data: { origin: 'Hà Nội', destination: 'TP.HCM' } });
  const r2 = await prisma.route.create({ data: { origin: 'Đà Nẵng', destination: 'Huế' } });
  const r3 = await prisma.route.create({ data: { origin: 'Cần Thơ', destination: 'Đà Lạt' } });

  // ---- Trips ----
  // today in VN time
  const now = new Date();
  const todayStart = startOfDay(toZonedTime(now, TZ));

  const tripData: Array<{
    routeId: string;
    busId: string;
    departureAt: Date;
    price: number;
    status: TripStatus;
    salesClosed: boolean;
  }> = [
    // Route 1: Hà Nội → TP.HCM (scheduled, various prices)
    {
      routeId: r1.id,
      busId: buses[0].id,
      departureAt: vnTime(addDays(todayStart, 0), 6, 0),
      price: 250000,
      status: 'scheduled',
      salesClosed: false,
    },
    {
      routeId: r1.id,
      busId: buses[0].id,
      departureAt: vnTime(addDays(todayStart, 1), 8, 30),
      price: 270000,
      status: 'scheduled',
      salesClosed: false,
    },
    {
      routeId: r1.id,
      busId: buses[1].id,
      departureAt: vnTime(addDays(todayStart, 2), 14, 0),
      price: 300000,
      status: 'scheduled',
      salesClosed: false,
    },
    {
      routeId: r1.id,
      busId: buses[1].id,
      departureAt: vnTime(addDays(todayStart, 3), 20, 0),
      price: 280000,
      status: 'scheduled',
      salesClosed: false,
    },
    // AC-3 coverage: cancelled trip
    {
      routeId: r1.id,
      busId: buses[0].id,
      departureAt: vnTime(addDays(todayStart, 4), 10, 0),
      price: 260000,
      status: 'cancelled',
      salesClosed: false,
    },
    // AC-3 coverage: salesClosed trip
    {
      routeId: r1.id,
      busId: buses[1].id,
      departureAt: vnTime(addDays(todayStart, 5), 12, 0),
      price: 290000,
      status: 'scheduled',
      salesClosed: true,
    },
    // Route 2: Đà Nẵng → Huế
    {
      routeId: r2.id,
      busId: buses[3].id,
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
      departureAt: vnTime(addDays(todayStart, 1), 11, 0),
      price: 220000,
      status: 'scheduled',
      salesClosed: false,
    },
    {
      routeId: r2.id,
      busId: buses[3].id,
      departureAt: vnTime(addDays(todayStart, 2), 13, 0),
      price: 210000,
      status: 'scheduled',
      salesClosed: false,
    },
    // Route 3: Cần Thơ → Đà Lạt
    {
      routeId: r3.id,
      busId: buses[4].id,
      departureAt: vnTime(addDays(todayStart, 1), 9, 0),
      price: 350000,
      status: 'scheduled',
      salesClosed: false,
    },
    {
      routeId: r3.id,
      busId: buses[4].id,
      departureAt: vnTime(addDays(todayStart, 7), 15, 0),
      price: 340000,
      status: 'scheduled',
      salesClosed: false,
    },
  ];

  for (const trip of tripData) {
    await prisma.trip.create({ data: trip });
  }

  console.log(
    `Seeded: 2 operators, 5 buses, 3 routes, ${tripData.length} trips (mix of statuses for AC-3).`
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
