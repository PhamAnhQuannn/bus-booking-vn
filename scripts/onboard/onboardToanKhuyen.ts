/**
 * Onboard the operator "TOÀN KHUYÊN – MINH TUYẾN" — a daily two-way North–South
 * route (Thanh Hóa ↔ Sài Gòn) with a sleeper bus, then materialize its trips.
 *
 * One-shot provisioning script (mirrors scripts/seed/seed-operator.ts self-contained
 * prisma bootstrap + scripts/admin/createOperator.ts dry-run/--confirm guard). It
 * creates, in a single $transaction:
 *   Place ×2 (typeahead suggestions) → Operator (APPROVED) → OperatorUser (login,
 *   known temp password, forced change) → Bus (sleeper) → Route ×2 (each direction)
 *   → RecurringTripTemplate ×2 (daily, daysOfMask=127).
 * After commit it calls generateTripsFromTemplates() so trips appear immediately
 * (30-day horizon) instead of waiting for the 01:00 cron.
 *
 * eSMS is stubbed in this environment, so the temp password is PRINTED ONCE (like
 * scripts/seed/seed-operator.ts) — hand it to the operator; they rotate it at
 * /op/first-login (requiresPasswordChange=true).
 *
 * Idempotent: re-running detects the existing OperatorUser by phone and exits
 * without a second insert.
 *
 * Run (dev):  pnpm tsx --env-file=.env.local scripts/onboard/onboardToanKhuyen.ts \
 *               --email=ops@toankhuyen.vn --plate=36B-12345 \
 *               --price-bn=750000 --price-nb=750000 --confirm
 * Run (prod): pnpm tsx --env-file=.env.production scripts/onboard/onboardToanKhuyen.ts … --confirm
 * Without --confirm it prints the plan and exits non-zero with NO DB mutation.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { format, addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
// Deep imports (not barrels) — node-safe leaf modules; barrels re-export server-only.
import { buildUsername, ensureUniqueUsername } from '@/lib/auth/operatorUsername';
import { hash } from '@/lib/auth/password';
import { genTempPassword } from '@/lib/staff/genTempPassword';
import { normalizePhone } from '@/lib/core/validation/phone';
import { redactPhone } from '@/lib/audit/redactPhone';
import { readOpt, hasConfirm } from '../admin/_client';

const TZ = 'Asia/Ho_Chi_Minh';

// ---- Fixed brand data (from the card) ----------------------------------------
const BRAND_NAME = 'Toàn Khuyên – Minh Tuyến';
const DEFAULT_LEGAL_NAME = 'Toàn Khuyên – Minh Tuyến';
const DEFAULT_PHONE = '0989507520'; // ĐT Toàn (primary contact / login)
const NORTH = 'Thanh Hóa';
const SOUTH = 'Sài Gòn';

interface PlaceSeed {
  canonicalName: string;
  slug: string;
  aliases: string[];
}
// Aliases make each boarding town searchable → it resolves to the route endpoint so
// "Nông Cống → Sài Gòn" finds the one physical Thanh Hóa→Sài Gòn trip. North towns are
// Thanh Hóa districts (correct). South entries are this route's specific pickup points
// (some in Bình Dương/Bình Phước) — a search convenience for this corridor, NOT the bare
// province names, to avoid polluting the registry for future real routes there.
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

// Display-only boarding schedule per direction (from the operator card). One bus, staggered
// pickups — NOT separate trips (that would double-count seats).
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

async function upsertPlace(tx: Prisma.TransactionClient, p: PlaceSeed): Promise<string> {
  // Place is a GLOBAL shared registry — MERGE (union) aliases with any already present
  // (another operator's onboarding may have added some), never overwrite.
  const existing = await tx.place.findUnique({ where: { slug: p.slug }, select: { aliases: true } });
  const mergedAliases = [...new Set([...(existing?.aliases ?? []), ...p.aliases])];
  const row = await tx.place.upsert({
    where: { slug: p.slug },
    update: { canonicalName: p.canonicalName, aliases: mergedAliases },
    create: { canonicalName: p.canonicalName, slug: p.slug, aliases: mergedAliases },
    select: { id: true },
  });
  return row.id;
}

async function main() {
  const argv = process.argv.slice(2);

  // ---- Args ----
  const contactEmail = readOpt(argv, 'email');
  const licensePlate = readOpt(argv, 'plate');
  const priceBnStr = readOpt(argv, 'price-bn') ?? '850000'; // default fare 850k both ways
  const priceNbStr = readOpt(argv, 'price-nb') ?? '850000';
  const legalName = readOpt(argv, 'legal-name') ?? DEFAULT_LEGAL_NAME;
  const rawPhone = readOpt(argv, 'phone') ?? DEFAULT_PHONE;
  const durationMinutes = Number(readOpt(argv, 'duration-min') ?? '1920'); // ~32h estimate
  const depBn = readOpt(argv, 'dep-bn') ?? '06:00';
  const depNb = readOpt(argv, 'dep-nb') ?? '06:00';
  const capacity = Number(readOpt(argv, 'capacity') ?? '40');

  if (!contactEmail || !licensePlate) {
    console.error(
      'usage: onboardToanKhuyen --email=… --plate=… ' +
        '[--price-bn=850000] [--price-nb=850000] [--legal-name=…] [--phone=…] [--duration-min=1920] ' +
        '[--dep-bn=06:00] [--dep-nb=06:00] [--capacity=40] [--valid-until=YYYY-MM-DD] --confirm'
    );
    process.exit(2);
  }

  const priceBn = Number(priceBnStr);
  const priceNb = Number(priceNbStr);
  if (![priceBn, priceNb, durationMinutes, capacity].every((n) => Number.isInteger(n) && n >= 0)) {
    console.error('price-bn / price-nb / duration-min / capacity must be non-negative integers');
    process.exit(2);
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(depBn) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(depNb)) {
    console.error('dep-bn / dep-nb must be HH:MM (00:00–23:59)');
    process.exit(2);
  }

  const loginPhone = normalizePhone(rawPhone);
  const vnNow = toZonedTime(new Date(), TZ);
  const validFromStr = format(vnNow, 'yyyy-MM-dd');
  const validUntilStr = readOpt(argv, 'valid-until') ?? format(addDays(vnNow, 365), 'yyyy-MM-dd');

  console.log('Proposed: onboard operator');
  console.log(`  brand / legal:  ${BRAND_NAME}  /  ${legalName}`);
  console.log(`  contactEmail:   ${contactEmail}`);
  console.log(`  contactPhone:   ${redactPhone(loginPhone)}`);
  console.log(`  bus:            sleeper, ${capacity} giường, plate ${licensePlate}`);
  console.log(`  route 1:        ${NORTH} → ${SOUTH}  dep ${depBn}  price ${priceBn.toLocaleString('vi-VN')}đ`);
  console.log(`  route 2:        ${SOUTH} → ${NORTH}  dep ${depNb}  price ${priceNb.toLocaleString('vi-VN')}đ`);
  console.log(`  daily template: daysOfMask=127  valid ${validFromStr} → ${validUntilStr}  (duration ${durationMinutes}m)`);

  if (!hasConfirm(argv)) {
    console.error('\nDry run — re-run with --confirm to apply. No changes made.');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Sync the shared Place registry FIRST, before the idempotent operator guard.
    // Alias additions (e.g. a new boarding town like "Ngã tư Miếu Ông Cù") must land
    // even when the operator already exists — otherwise re-running to add a pickup
    // point is a silent no-op (the guard below returns before the main tx).
    await prisma.$transaction(async (tx) => {
      await upsertPlace(tx, PLACE_NORTH);
      await upsertPlace(tx, PLACE_SOUTH);
    });

    // Idempotent guard — phone is @unique on OperatorUser.
    const existing = await prisma.operatorUser.findUnique({
      where: { phone: loginPhone },
      select: { username: true },
    });
    if (existing) {
      console.log('\nOperator login already exists for this phone — not re-onboarding.');
      console.log(`  username: ${existing.username}`);
      console.log('  (password is only stored hashed; delete the OperatorUser row to reset.)');
      return;
    }

    const password = genTempPassword();
    const passwordHash = await hash(password);

    const out = await prisma.$transaction(async (tx) => {
      const northId = await upsertPlace(tx, PLACE_NORTH);
      const southId = await upsertPlace(tx, PLACE_SOUTH);

      const operator = await tx.operator.create({
        data: {
          legalName,
          brandName: BRAND_NAME,
          contactName: 'Toàn',
          contactEmail,
          contactPhone: loginPhone,
          notificationPhone: loginPhone,
          status: 'APPROVED',
        },
        select: { id: true },
      });

      const username = await ensureUniqueUsername(tx, buildUsername(BRAND_NAME, loginPhone));
      await tx.operatorUser.create({
        data: {
          operatorId: operator.id,
          username,
          phone: loginPhone,
          contactPhone: loginPhone,
          notificationPhone: loginPhone,
          passwordHash,
          displayName: BRAND_NAME,
          role: 'admin',
          requiresPasswordChange: true,
        },
        select: { id: true },
      });

      const bus = await tx.bus.create({
        data: { operatorId: operator.id, capacity, licensePlate, busType: 'sleeper' },
        select: { id: true },
      });

      const routeBn = await tx.route.create({
        data: {
          operatorId: operator.id,
          origin: NORTH,
          destination: SOUTH,
          durationMinutes,
          originPlaceId: northId,
          destPlaceId: southId,
          boardingSchedule: BOARDING_NORTH,
        },
        select: { id: true },
      });
      const routeNb = await tx.route.create({
        data: {
          operatorId: operator.id,
          origin: SOUTH,
          destination: NORTH,
          durationMinutes,
          originPlaceId: southId,
          destPlaceId: northId,
          boardingSchedule: BOARDING_SOUTH,
        },
        select: { id: true },
      });

      const tplBn = await tx.recurringTripTemplate.create({
        data: {
          operatorId: operator.id,
          routeId: routeBn.id,
          busId: bus.id,
          price: priceBn,
          departureLocalTime: depBn,
          daysOfMask: 127,
          validFrom: new Date(validFromStr),
          validUntil: new Date(validUntilStr),
        },
        select: { id: true },
      });
      const tplNb = await tx.recurringTripTemplate.create({
        data: {
          operatorId: operator.id,
          routeId: routeNb.id,
          busId: bus.id,
          price: priceNb,
          departureLocalTime: depNb,
          daysOfMask: 127,
          validFrom: new Date(validFromStr),
          validUntil: new Date(validUntilStr),
        },
        select: { id: true },
      });

      return {
        operatorId: operator.id,
        username,
        busId: bus.id,
        routeBn: routeBn.id,
        routeNb: routeNb.id,
        tplBn: tplBn.id,
        tplNb: tplNb.id,
      };
    });

    // Materialize trips now (30-day horizon) — reuses the cron generator so the
    // idempotency + timezone logic is identical to the nightly run. It opens its
    // own connection from DATABASE_URL (does not take our tx client).
    const { generateTripsFromTemplates } = await import('@/lib/trips/generateFromTemplate');
    const gen = await generateTripsFromTemplates();

    console.log('\nOnboarded (APPROVED, forced password change on first login):');
    console.log(`  operatorId:  ${out.operatorId}`);
    console.log(`  username:    ${out.username}`);
    console.log(`  password:    ${password}`);
    console.log(`  login:       /op/login  (then /op/first-login to change)`);
    console.log(`  busId:       ${out.busId}`);
    console.log(`  routes:      ${NORTH}→${SOUTH} ${out.routeBn} · ${SOUTH}→${NORTH} ${out.routeNb}`);
    console.log(`  templates:   ${NORTH}→${SOUTH} ${out.tplBn} · ${SOUTH}→${NORTH} ${out.tplNb}`);
    console.log(`  trips gen:   generated=${gen.generated} skipped=${gen.skipped} failed=${gen.failed}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('\nFailed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
