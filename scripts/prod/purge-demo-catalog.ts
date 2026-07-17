/**
 * One-off: purge the demo/seed CATALOG (operators, buses, routes, trips, and the
 * seeded operator logins) from a database so a real catalog can be built via the
 * admin/operator console. This exists because `prisma/seed.ts` fixtures shipped to
 * the live DB and must be removed WITHOUT re-running `db seed` (which re-inserts
 * them) and WITHOUT touching real transactions or the append-only ledger.
 *
 * PRESERVES: AdminUser, FeeConfig, Customer/Session/OtpAttempt (not catalog).
 * DELETES:   the operator→bus→route→trip graph + operator auth rows.
 *
 * Safety:
 *   - Refuses to run unless CONFIRM_PURGE=yes.
 *   - HARD-ABORTS if any LedgerEntry rows exist (append-only real financial record).
 *   - ABORTS if any Booking/Hold/PaymentEvent rows exist, unless FORCE=yes.
 *   - All deletes run inside one $transaction (atomic — partial failure rolls back).
 *
 * Deletion order mirrors prisma/seed.ts:49-83 (FK children-first).
 *
 * Run (against the target DB — use the DIRECT_URL for prod, not the pooled URL):
 *   DATABASE_URL=<direct-url> CONFIRM_PURGE=yes pnpm tsx scripts/prod/purge-demo-catalog.ts
 *   # add FORCE=yes only if you have reviewed the non-zero Booking/Hold/PaymentEvent counts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.CONFIRM_PURGE !== 'yes') {
    throw new Error('Refusing to purge: set CONFIRM_PURGE=yes to proceed.');
  }
  const force = process.env.FORCE === 'yes';

  const [ledger, bookings, holds, payments, operators, routes, trips] = await Promise.all([
    prisma.ledgerEntry.count(),
    prisma.booking.count(),
    prisma.hold.count(),
    prisma.paymentEvent.count(),
    prisma.operator.count(),
    prisma.route.count(),
    prisma.trip.count(),
  ]);

  console.log('Pre-purge counts:', {
    ledger,
    bookings,
    holds,
    payments,
    operators,
    routes,
    trips,
  });

  if (ledger > 0) {
    throw new Error(
      `Refusing to purge: ${ledger} LedgerEntry rows exist (append-only real financial record). ` +
        'Real business activity has occurred — do not purge the catalog under it.',
    );
  }
  if ((bookings > 0 || holds > 0 || payments > 0) && !force) {
    throw new Error(
      `Refusing to purge: found bookings=${bookings} holds=${holds} payments=${payments}. ` +
        'Review these (they may be real) then re-run with FORCE=yes if you are certain.',
    );
  }

  await prisma.$transaction(async (tx) => {
    // FK children-first — same order as prisma/seed.ts:49-83.
    await tx.notificationLog.deleteMany();
    await tx.paymentEvent.deleteMany();
    await tx.booking.deleteMany();
    await tx.hold.deleteMany();

    await tx.recurringGenerationLog.deleteMany();
    await tx.payout.deleteMany();
    await tx.operatorUser.updateMany({ data: { assignedTripId: null } });
    await tx.trip.deleteMany();

    await tx.recurringTripTemplate.deleteMany();
    await tx.route.deleteMany();
    await tx.busMaintenance.deleteMany();
    await tx.bus.deleteMany();

    await tx.operatorOtpAttempt.deleteMany();
    await tx.operatorSession.deleteMany();
    await tx.operatorUser.deleteMany();
    await tx.operator.deleteMany();
    // Preserved: AdminUser, FeeConfig, Customer, Session, OtpAttempt.
  });

  const [operatorsAfter, routesAfter, tripsAfter, admins, feeConfigs] = await Promise.all([
    prisma.operator.count(),
    prisma.route.count(),
    prisma.trip.count(),
    prisma.adminUser.count(),
    prisma.feeConfig.count(),
  ]);

  console.log('Post-purge counts:', {
    operators: operatorsAfter,
    routes: routesAfter,
    trips: tripsAfter,
    adminsPreserved: admins,
    feeConfigsPreserved: feeConfigs,
  });
  console.log('Demo catalog purged. Onboard real operators via the admin console next.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
