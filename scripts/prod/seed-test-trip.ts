/**
 * One-off: seed ONE bookable trip so the live bank-transfer (VietQR/SePay) payment
 * flow can be exercised end-to-end on prod. Inserts a minimal APPROVED test
 * operator → bus → route → trip priced 10,000 VND, departing 3 days out.
 *
 * A 1-seat booking on this trip totals exactly 10,000 VND (totalVnd = price *
 * ticketCount, lib/booking/bookingRepo.ts), so the app renders a VietQR for 10k
 * with the BB- memo baked in — no QR changes needed.
 *
 * Counterpart to scripts/prod/purge-demo-catalog.ts (same connection scaffold).
 * status is hand-set to APPROVED because only APPROVED operators are search-visible
 * (default PENDING_REVIEW is hidden). No OperatorUser/Place/BusMaintenance needed —
 * search gates on the operator+bus+route+trip graph only.
 *
 * Safety:
 *   - Refuses to run unless CONFIRM_SEED=yes.
 *   - Idempotent-ish: aborts if the TEST-0001 bus already exists (re-run guard).
 *   - Single $transaction (parent-first: Operator → Bus → Route → Trip).
 *
 * Run (against the target DB — use the DIRECT_URL for prod, not the pooled URL):
 *   DATABASE_URL=<direct-url> CONFIRM_SEED=yes pnpm tsx scripts/prod/seed-test-trip.ts
 *
 * Cleanup: once a booking on this trip is PAID, append-only LedgerEntry rows exist
 * and purge-demo-catalog.ts will refuse to run. To hide the trip afterward without
 * touching the ledger, set Route.deactivatedAt (or Trip.status='cancelled').
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

const TEST_PLATE = 'TEST-0001';

async function main() {
  if (process.env.CONFIRM_SEED !== 'yes') {
    throw new Error('Refusing to seed: set CONFIRM_SEED=yes to proceed.');
  }

  const existing = await prisma.bus.findFirst({ where: { licensePlate: TEST_PLATE } });
  if (existing) {
    throw new Error(
      `Test bus ${TEST_PLATE} already exists (operatorId=${existing.operatorId}). ` +
        'A test trip was likely already seeded — refusing to duplicate.',
    );
  }

  // Depart 3 days out, 08:00 UTC — comfortably in the future for the search gate.
  const departureAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  departureAt.setUTCHours(8, 0, 0, 0);

  const trip = await prisma.$transaction(async (tx) => {
    const operator = await tx.operator.create({
      data: {
        legalName: 'TEST PAYMENT VERIFY',
        contactPhone: '+8490xxxxxx1',
        contactEmail: 'payment-test@lenxevn.com',
        status: 'APPROVED',
      },
    });

    const bus = await tx.bus.create({
      data: {
        operatorId: operator.id,
        capacity: 16,
        licensePlate: TEST_PLATE,
        busType: 'coach',
      },
    });

    const route = await tx.route.create({
      data: {
        operatorId: operator.id,
        origin: 'Hà Nội',
        destination: 'Hải Phòng',
        durationMinutes: 120,
      },
    });

    return tx.trip.create({
      data: {
        routeId: route.id,
        busId: bus.id,
        operatorId: operator.id,
        departureAt,
        price: 10000,
        // status='scheduled', salesClosed=false via schema defaults — bookable now.
      },
    });
  });

  console.log('Seeded bookable test trip:');
  console.log({
    tripId: trip.id,
    operatorId: trip.operatorId,
    routeId: trip.routeId,
    busId: trip.busId,
    price: trip.price,
    departureAt: trip.departureAt.toISOString(),
  });
  console.log('');
  console.log('Search on lenxevn.com:');
  console.log(`  From: Hà Nội   To: Hải Phòng   Date: ${trip.departureAt.toISOString().slice(0, 10)}`);
  console.log('Book 1 seat → Bank Transfer → QR should show 10,000đ + a BB- memo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
