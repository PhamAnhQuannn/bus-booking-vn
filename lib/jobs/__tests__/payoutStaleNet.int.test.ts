/**
 * Integration test — P0-2 stale payout net (money-flow audit 2026-08-11).
 *
 * BUG: `Payout.net` is frozen at trip completion (completeTripCore, calcPayout).
 * A booking on that trip can still be refunded AFTER completion (REFUNDABLE_STATUSES
 * includes 'completed') — the refund claws the operator's credit on the ledger
 * (refund_debit), but processPayouts pays the ORIGINAL frozen `Payout.net` regardless.
 * So the platform pays the operator for revenue that was refunded → over-disbursement.
 *
 * The assertion encodes the CORRECT money invariant: after a full refund of the
 * trip's revenue, the sweep must NOT disburse the frozen net (the operator is owed
 * nothing for a refunded trip). It FAILS on the buggy code (Payout paid in full),
 * passes once processPayouts settles against the live ledger.
 *
 * DB-gated — run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { appendLedgerEntry } from '@/lib/ledger';
import { getOperatorBalance } from '@/lib/ledger';
import { refundOut } from '@/lib/payment';
import { processPayouts } from '@/lib/jobs';

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;
let bookingId: string;
let payoutId: string;

const GROSS = 500_000;
const FEE = 30_000;
const NET = GROSS - FEE; // 470_000 frozen on the Payout

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
    data: { legalName: 'Stale Net Op', contactPhone: '+8490xxxxxx3', contactEmail: 'stalenet@test.invalid' },
  });
  operatorId = op.id;
  await prisma.payoutAccount.create({
    data: { operatorId, bankName: 'Test Bank', accountNumber: '0123456789', accountHolderName: 'Stale Net Op', verifiedAt: new Date(), verifyMethod: 'name_match' },
  });
  const bus = await prisma.bus.create({ data: { operatorId, capacity: 20, licensePlate: 'TEST-STN-001', busType: 'coach' } });
  busId = bus.id;
  const route = await prisma.route.create({ data: { origin: 'STN Origin', destination: 'STN Destination', operatorId, durationMinutes: 300 } });
  routeId = route.id;
  const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const trip = await prisma.trip.create({
    data: { routeId, busId, operatorId, departureAt: past, price: GROSS, status: 'completed', salesClosed: true, completedAt: past },
  });
  tripId = trip.id;
  bookingId = randomUUID();
  await prisma.booking.create({
    data: {
      id: bookingId, bookingRef: `BB-2002-${randomUUID().slice(0, 4)}-stn1`, confirmationToken: randomUUID().replace(/-/g, '') + 'sn',
      tripId, buyerName: 'Stale Buyer', buyerEmail: 'stalebuyer@test.invalid', buyerPhone: '+8490xxxxxx2',
      ticketCount: 1, totalVnd: GROSS, paymentMethod: 'bank_transfer', paymentExternalRef: 'stub_inbound_txn_stn', status: 'completed',
    },
  });
  await appendLedgerEntry({ operatorId, bookingId, type: 'booking_credit', amountMinor: BigInt(GROSS), sourceEventId: `booking_credit:${bookingId}` });
  await appendLedgerEntry({ operatorId, bookingId, type: 'platform_fee', amountMinor: BigInt(-FEE), sourceEventId: `platform_fee:${bookingId}` });

  // The auto per-trip Payout with the net frozen at completion.
  const payout = await prisma.payout.create({
    data: { tripId, operatorId, gross: BigInt(GROSS), platformFee: BigInt(FEE), net: BigInt(NET), status: 'requested', scheduledAt: past },
    select: { id: true },
  });
  payoutId = payout.id;
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
  await prisma.payoutAccount.deleteMany({ where: { operatorId } });
  await prisma.notificationLog.deleteMany({ where: { bookingId } });
  await prisma.booking.deleteMany({ where: { id: bookingId } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('P0-2 — refund after completion must not be over-paid by the frozen net', () => {
  it('a fully-refunded trip disburses nothing at the sweep', async () => {
    // Full refund of the trip's fare after completion (clawing the operator credit).
    const refund = await refundOut({
      bookingId,
      amountMinor: GROSS,
      reason: 'operator_cancel',
      idempotencyKey: `cancel:${tripId}:${bookingId}`,
    });
    expect(refund.refunded).toBe(true);

    // The operator's live eligible balance for this trip is now <= 0 (revenue clawed back).
    // Sweep the payouts.
    await prisma.$transaction((tx) => processPayouts(tx));

    // MONEY INVARIANT: nothing should have been disbursed for a refunded trip.
    const bal = await getOperatorBalance(operatorId);
    expect(bal.paidOut).toBe(BigInt(0)); // BUG: frozen net 470_000 is paid regardless

    const payout = await prisma.payout.findUniqueOrThrow({ where: { id: payoutId } });
    expect(payout.status).not.toBe('paid'); // must not disburse the stale frozen net

    const debits = await prisma.ledgerEntry.count({ where: { operatorId, type: 'payout_debit' } });
    expect(debits).toBe(0);
  });
});
