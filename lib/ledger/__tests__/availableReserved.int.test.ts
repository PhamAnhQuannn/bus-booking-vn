/**
 * Integration test — P0-1 `reserved` term edge cases (money-flow audit 2026-08-11).
 *
 * Companion to payoutDoublePay.int.test.ts. Locks down the corners of the
 * `available = settledEligible − paidOut − reserved` change (lib/ledger/balance.ts
 * + lib/ledger/withdrawal.ts), where `reserved` = net of DUE pending payouts
 * (status requested|processing, scheduledAt<=NOW) that have NOT yet written a
 * payout_debit.
 *
 *   - requested + due          → reserved (available excludes it)
 *   - processing + due         → reserved
 *   - requested but NOT due     → NOT reserved (and pre-T+1 available is 0 anyway)
 *   - failed                    → NOT reserved (money still owed → withdrawable)
 *   - on-demand withdrawal Payout (has payout_debit) → NOT double-counted
 *
 * DB-gated — run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { appendLedgerEntry } from '../ledgerRepo';
import { getOperatorBalance } from '../balance';
import { calcPayout } from '../calcPayout';
import { requestWithdrawal } from '../withdrawal';

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;
let bookingId: string;
let autoPayoutId: string;

const GROSS = 500_000;
const { net: NET } = calcPayout({ grossPaidBookings: GROSS });
const NET_NUM = Number(NET); // 470_000
const FEE_NUM = GROSS - NET_NUM;

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

const PAST = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
const FUTURE = new Date(Date.now() + 12 * 60 * 60 * 1000);

beforeAll(async () => {
  await dropStrayRequestedPayouts();

  const op = await prisma.operator.create({
    data: { legalName: 'Reserved Edge Op', contactPhone: '+8490xxxxxx3', contactEmail: 'reservededge@test.invalid' },
  });
  operatorId = op.id;
  await prisma.payoutAccount.create({
    data: {
      operatorId,
      bankName: 'Test Bank',
      accountNumber: '0123456789',
      accountHolderName: 'Reserved Edge Op',
      verifiedAt: new Date(),
      verifyMethod: 'name_match',
    },
  });
  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 20, licensePlate: 'TEST-RSV-001', busType: 'coach' },
  });
  busId = bus.id;
  const route = await prisma.route.create({
    data: { origin: 'RSV Origin', destination: 'RSV Destination', operatorId, durationMinutes: 300 },
  });
  routeId = route.id;
  const trip = await prisma.trip.create({
    data: { routeId, busId, operatorId, departureAt: PAST, price: GROSS, status: 'completed', salesClosed: true, completedAt: PAST },
  });
  tripId = trip.id;
  bookingId = randomUUID();
  await prisma.booking.create({
    data: {
      id: bookingId,
      bookingRef: `BB-2091-${randomUUID().slice(0, 4)}-rsve`,
      confirmationToken: randomUUID().replace(/-/g, '') + 'rv',
      tripId,
      buyerName: 'Reserved Buyer',
      buyerEmail: 'reserved@test.invalid',
      buyerPhone: '+8490xxxxxx2',
      ticketCount: 1,
      totalVnd: GROSS,
      paymentMethod: 'bank_transfer',
      paymentExternalRef: 'stub_inbound_txn_rsv',
      status: 'completed',
    },
  });
  await appendLedgerEntry({ operatorId, bookingId, type: 'booking_credit', amountMinor: BigInt(GROSS), sourceEventId: `booking_credit:${bookingId}` });
  await appendLedgerEntry({ operatorId, bookingId, type: 'platform_fee', amountMinor: BigInt(-FEE_NUM), sourceEventId: `platform_fee:${bookingId}` });

  const ap = await prisma.payout.create({
    data: { tripId, operatorId, gross: BigInt(GROSS), platformFee: BigInt(FEE_NUM), net: BigInt(NET_NUM), status: 'requested', scheduledAt: PAST },
    select: { id: true },
  });
  autoPayoutId = ap.id;
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
  await prisma.booking.deleteMany({ where: { id: bookingId } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('P0-1 reserved term — edge cases', () => {
  it('a DUE requested auto-payout reserves the net → available 0', async () => {
    await prisma.payout.update({ where: { id: autoPayoutId }, data: { status: 'requested', scheduledAt: PAST } });
    expect((await getOperatorBalance(operatorId)).available).toBe(BigInt(0));
  });

  it('a DUE processing auto-payout is also reserved → available 0', async () => {
    await prisma.payout.update({ where: { id: autoPayoutId }, data: { status: 'processing' } });
    expect((await getOperatorBalance(operatorId)).available).toBe(BigInt(0));
    await prisma.payout.update({ where: { id: autoPayoutId }, data: { status: 'requested' } });
  });

  it('a NOT-yet-due requested auto-payout is not reserved (scheduledAt future)', async () => {
    await prisma.payout.update({ where: { id: autoPayoutId }, data: { scheduledAt: FUTURE } });
    // settledEligible still 470k (trip completed past T+1); reserved 0 (not due).
    expect((await getOperatorBalance(operatorId)).available).toBe(BigInt(NET_NUM));
    await prisma.payout.update({ where: { id: autoPayoutId }, data: { scheduledAt: PAST } });
  });

  it('a failed auto-payout is not reserved; money is withdrawable and the withdrawal is not double-counted', async () => {
    // Failed payout disbursed nothing (no payout_debit) → money still owed → withdrawable.
    await prisma.payout.update({ where: { id: autoPayoutId }, data: { status: 'failed' } });
    expect((await getOperatorBalance(operatorId)).available).toBe(BigInt(NET_NUM));

    const res = await requestWithdrawal({ operatorId, amountMinor: NET_NUM, idempotencyKey: `wd-rsv-${randomUUID()}` });
    expect(res.ok).toBe(true);

    // The withdrawal Payout is `requested` + due but HAS a payout_debit → excluded
    // from `reserved`; its drain lives in paidOut. available must be 0, NOT −NET.
    const bal = await getOperatorBalance(operatorId);
    expect(bal.paidOut).toBe(BigInt(NET_NUM));
    expect(bal.available).toBe(BigInt(0));
  });
});
