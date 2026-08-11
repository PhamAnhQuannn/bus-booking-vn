/**
 * Integration test — #517: a chargeback must be clawed from the operator's COVERABLE
 * revenue even while a payout is pending (reserved), NOT absorbed by the platform.
 *
 * BUG (money-flow audit review): the new `reserved` term (P0-1) lowered
 * getOperatorBalance().available, which recordChargeback used to size the platform
 * bad-debt backstop. While a due auto-payout was `requested` (reserved) but not yet swept,
 * `available` was 0 → a chargeback found availableCover=0 → the platform wrote a full
 * backstop adjustment, absorbing a chargeback a solvent operator should have covered.
 *
 * FIX: size the shortfall against `coverable` (settledEligible − paidOut, WITHOUT the
 * reserve). The reserved money is still the operator's; the chargeback is recovered by
 * reducing the eventual payout (processPayouts #516 delta). So backstopped must be 0.
 *
 * DB-gated — run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { appendLedgerEntry, getOperatorBalance } from '@/lib/ledger';
import { recordChargeback } from '../chargeback';

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;
let bookingId: string;

const GROSS = 500_000;
const FEE = 30_000;
const NET = GROSS - FEE; // 470_000 eligible revenue
const CHARGEBACK = 100_000; // < NET → fully coverable by the operator's revenue

async function dropStrayRequestedPayouts() {
  const strays = await prisma.payout.findMany({ where: { status: 'requested' }, select: { id: true } });
  const ids = strays.map((p) => p.id);
  if (!ids.length) return;
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_update" ON "LedgerEntry"');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_delete" ON "LedgerEntry"');
  await prisma.ledgerEntry.deleteMany({ where: { payoutId: { in: ids } } });
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_update" BEFORE UPDATE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_delete" BEFORE DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.payout.deleteMany({ where: { id: { in: ids } } });
}

beforeAll(async () => {
  await dropStrayRequestedPayouts();

  const op = await prisma.operator.create({
    data: { legalName: 'CB Reserved Op', contactPhone: '+8490xxxxxx3', contactEmail: 'cbreserved@test.invalid' },
  });
  operatorId = op.id;
  const bus = await prisma.bus.create({ data: { operatorId, capacity: 20, licensePlate: 'TEST-CBR-001', busType: 'coach' } });
  busId = bus.id;
  const route = await prisma.route.create({ data: { origin: 'CBR Origin', destination: 'CBR Destination', operatorId, durationMinutes: 300 } });
  routeId = route.id;
  const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const trip = await prisma.trip.create({
    data: { routeId, busId, operatorId, departureAt: past, price: GROSS, status: 'completed', salesClosed: true, completedAt: past },
  });
  tripId = trip.id;
  bookingId = randomUUID();
  await prisma.booking.create({
    data: {
      id: bookingId, bookingRef: `BB-2017-${randomUUID().slice(0, 4)}-cb1`, confirmationToken: randomUUID().replace(/-/g, '') + 'cb',
      tripId, buyerName: 'CB Buyer', buyerEmail: 'cbbuyer@test.invalid', buyerPhone: '+8490xxxxxx2',
      ticketCount: 1, totalVnd: GROSS, paymentMethod: 'bank_transfer', paymentExternalRef: 'stub_inbound_cbr', status: 'completed',
    },
  });
  await appendLedgerEntry({ operatorId, bookingId, type: 'booking_credit', amountMinor: BigInt(GROSS), sourceEventId: `booking_credit:${bookingId}` });
  await appendLedgerEntry({ operatorId, bookingId, type: 'platform_fee', amountMinor: BigInt(-FEE), sourceEventId: `platform_fee:${bookingId}` });

  // DUE requested auto-payout → reserves the whole net → available becomes 0.
  await prisma.payout.create({
    data: { tripId, operatorId, gross: BigInt(GROSS), platformFee: BigInt(FEE), net: BigInt(NET), status: 'requested', scheduledAt: past },
  });
});

afterAll(async () => {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_update" ON "LedgerEntry"');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_delete" ON "LedgerEntry"');
  await prisma.ledgerEntry.deleteMany({ where: { operatorId } });
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_update" BEFORE UPDATE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_delete" BEFORE DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.payout.deleteMany({ where: { operatorId } });
  await prisma.booking.deleteMany({ where: { id: bookingId } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('#517 — chargeback covered by reserved-but-unpaid operator revenue', () => {
  it('reserves available to 0 yet the operator (not the platform) absorbs the chargeback', async () => {
    // Precondition: the DUE payout reserved the net → available is 0, coverable is NET.
    const before = await getOperatorBalance(operatorId);
    expect(before.available).toBe(BigInt(0));
    expect(before.coverable).toBe(BigInt(NET));

    const result = await recordChargeback({
      bookingId,
      amountMinor: CHARGEBACK,
      sourceEventId: `chargeback:${bookingId}`,
      liability: 'operator',
    });

    expect(result.recorded).toBe(true);
    // FIX: sized against coverable (NET), not available (0) → no platform backstop.
    expect(result.backstopped).toBe(0);

    // No backstop adjustment row was written; the operator's balance took the full hit.
    const backstopRows = await prisma.ledgerEntry.count({
      where: { operatorId, type: 'adjustment' },
    });
    expect(backstopRows).toBe(0);
  });
});
