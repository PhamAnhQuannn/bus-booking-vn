/**
 * Integration test — P0-2 partial-refund branch (money-flow audit 2026-08-11).
 *
 * Companion to payoutStaleNet.int.test.ts (which covers the FULL-refund → withhold
 * branch). Here a PARTIAL refund after completion reduces the trip's owed revenue,
 * and the sweep must disburse the reduced amount (frozen net + negative clawback
 * delta), reconcile Payout.net to it, and write a payout_debit for the actual amount.
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

const GROSS = 1_000_000;
const FEE = 60_000; // 6%
const NET = GROSS - FEE; // 940_000 frozen
const REFUND = 300_000; // partial refund after completion
const EXPECTED_DISBURSED = NET - REFUND; // 640_000

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
    data: { legalName: 'Partial Refund Op', contactPhone: '+8490xxxxxx3', contactEmail: 'partialrefund@test.invalid' },
  });
  operatorId = op.id;
  await prisma.payoutAccount.create({
    data: { operatorId, bankName: 'Test Bank', accountNumber: '0123456789', accountHolderName: 'Partial Refund Op', verifiedAt: new Date(), verifyMethod: 'name_match' },
  });
  const bus = await prisma.bus.create({ data: { operatorId, capacity: 20, licensePlate: 'TEST-PRF-001', busType: 'coach' } });
  busId = bus.id;
  const route = await prisma.route.create({ data: { origin: 'PRF Origin', destination: 'PRF Destination', operatorId, durationMinutes: 300 } });
  routeId = route.id;
  const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const trip = await prisma.trip.create({
    data: { routeId, busId, operatorId, departureAt: past, price: GROSS, status: 'completed', salesClosed: true, completedAt: past },
  });
  tripId = trip.id;
  bookingId = randomUUID();
  await prisma.booking.create({
    data: {
      id: bookingId, bookingRef: `BB-2002-${randomUUID().slice(0, 4)}-prf1`, confirmationToken: randomUUID().replace(/-/g, '') + 'pr',
      tripId, buyerName: 'Partial Buyer', buyerEmail: 'partialbuyer@test.invalid', buyerPhone: '+8490xxxxxx2',
      ticketCount: 2, totalVnd: GROSS, paymentMethod: 'bank_transfer', paymentExternalRef: 'stub_inbound_txn_prf', status: 'completed',
    },
  });
  await appendLedgerEntry({ operatorId, bookingId, type: 'booking_credit', amountMinor: BigInt(GROSS), sourceEventId: `booking_credit:${bookingId}` });
  await appendLedgerEntry({ operatorId, bookingId, type: 'platform_fee', amountMinor: BigInt(-FEE), sourceEventId: `platform_fee:${bookingId}` });
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

describe('P0-2 — partial refund reduces the payout to the live amount', () => {
  it('disburses frozen net minus the clawback, and reconciles Payout.net', async () => {
    const refund = await refundOut({
      bookingId,
      amountMinor: REFUND,
      reason: 'operator_cancel',
      idempotencyKey: `cancel:${tripId}:${bookingId}:partial`,
    });
    expect(refund.refunded).toBe(true);

    await prisma.$transaction((tx) => processPayouts(tx));

    // Only the reduced amount was disbursed.
    const bal = await getOperatorBalance(operatorId);
    expect(bal.paidOut).toBe(BigInt(EXPECTED_DISBURSED)); // 640_000, not the frozen 940_000

    const payout = await prisma.payout.findUniqueOrThrow({ where: { id: payoutId } });
    expect(payout.status).toBe('paid');
    expect(payout.net).toBe(BigInt(EXPECTED_DISBURSED)); // Payout.net reconciled to actual

    const debit = await prisma.ledgerEntry.findFirstOrThrow({ where: { payoutId, type: 'payout_debit' } });
    expect(debit.amount).toBe(BigInt(-EXPECTED_DISBURSED));
  });
});
