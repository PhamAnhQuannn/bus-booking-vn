/**
 * Integration test — P0-1 double-payout guard (money-flow audit 2026-08-11).
 *
 * BUG: two disbursement rails pay the SAME earned money.
 *   1. completeTripCore creates one `requested` Payout per trip (net N), which
 *      does NOT write a payout_debit until processPayouts pays it.
 *   2. On-demand withdrawal (lib/ledger/withdrawal) lets the operator pull their
 *      `available` balance — and `available` (settledEligible − paidOut) does NOT
 *      subtract a pending auto-Payout that has not yet drained the ledger.
 * So the same trip net is simultaneously (a) sitting as a requested auto-Payout
 * and (b) withdrawable. If the operator withdraws it, the sweep later pays BOTH
 * the auto-Payout and the withdrawal Payout → the money leaves twice.
 *
 * These assertions encode the CORRECT (post-fix) behaviour and therefore FAIL on
 * the buggy code (available shows N, the withdrawal is allowed), then pass once
 * `available` reserves the net already committed to a pending payout.
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
import { processPayouts } from '@/lib/jobs';

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;
let bookingId: string;
let autoPayoutId: string;

const GROSS = 500_000; // VND — one paid booking's total (net > min withdrawal floor)
const { platformFee, net: NET } = calcPayout({ grossPaidBookings: GROSS });
const FEE = Number(platformFee);
const NET_NUM = Number(NET); // = GROSS − FEE = available for this trip

async function dropStrayRequestedPayouts() {
  // processPayouts settles EVERY due 'requested' Payout globally inside one tx.
  // A stray from a prior crashed run would be paid in our sweep — drop debris.
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
    data: {
      legalName: 'P0-1 DoublePay Op',
      contactPhone: '+8490xxxxxx3',
      contactEmail: 'p01doublepay@test.invalid',
    },
  });
  operatorId = op.id;

  await prisma.payoutAccount.create({
    data: {
      operatorId,
      bankName: 'Test Bank',
      accountNumber: '0123456789',
      accountHolderName: 'P0-1 DoublePay Op',
      verifiedAt: new Date(),
      verifyMethod: 'name_match',
    },
  });

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 20, licensePlate: 'TEST-P01-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: { origin: 'P01 Origin', destination: 'P01 Destination', operatorId, durationMinutes: 300 },
  });
  routeId = route.id;

  // Completed trip whose completedAt is past T+1 → its credit/fee entries are
  // settlement-eligible (they count toward `available`).
  const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: past,
      price: GROSS,
      status: 'completed',
      salesClosed: true,
      completedAt: past,
    },
  });
  tripId = trip.id;

  bookingId = randomUUID();
  await prisma.booking.create({
    data: {
      id: bookingId,
      bookingRef: `BB-2001-${randomUUID().slice(0, 4)}-p01a`,
      confirmationToken: randomUUID().replace(/-/g, '') + 'p1',
      tripId,
      buyerName: 'DoublePay Buyer',
      buyerEmail: 'doublepay@test.invalid',
      buyerPhone: '+8490xxxxxx2',
      ticketCount: 1,
      totalVnd: GROSS,
      paymentMethod: 'bank_transfer',
      paymentExternalRef: 'stub_inbound_txn_p01',
      status: 'completed',
    },
  });

  // Paid-transition ledger entries: net = GROSS − FEE = available for this trip.
  await appendLedgerEntry({
    operatorId,
    bookingId,
    type: 'booking_credit',
    amountMinor: BigInt(GROSS),
    sourceEventId: `booking_credit:${bookingId}`,
  });
  await appendLedgerEntry({
    operatorId,
    bookingId,
    type: 'platform_fee',
    amountMinor: BigInt(-FEE),
    sourceEventId: `platform_fee:${bookingId}`,
  });

  // The auto-per-trip Payout (what completeTripCore creates): requested, net N,
  // scheduledAt already past so the sweep would pay it. NO payout_debit yet.
  const autoPayout = await prisma.payout.create({
    data: {
      tripId,
      operatorId,
      gross: BigInt(GROSS),
      platformFee: BigInt(FEE),
      net: BigInt(NET_NUM),
      status: 'requested',
      scheduledAt: past,
    },
    select: { id: true },
  });
  autoPayoutId = autoPayout.id;
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

describe('P0-1 — double-payout across auto-payout + withdrawal rails', () => {
  it('reserves the pending auto-payout net so `available` excludes it', async () => {
    // The trip net is already committed to the requested auto-Payout, so it must
    // NOT show as withdrawable. BUG: available returns NET (double-counts).
    const bal = await getOperatorBalance(operatorId);
    expect(bal.available).toBe(BigInt(0));
  });

  it('blocks a withdrawal of money already committed to a pending auto-payout', async () => {
    const res = await requestWithdrawal({
      operatorId,
      amountMinor: NET_NUM,
      idempotencyKey: `wd-p01-${randomUUID()}`,
    });
    // BUG: succeeds → creates a 2nd Payout for the same money → double-send at sweep.
    expect(res).toEqual({ ok: false, reason: 'insufficient_available' });
  });

  it('pays the auto-payout exactly once — never double-disburses', async () => {
    await prisma.$transaction((tx) => processPayouts(tx));

    // Only the auto-Payout should have been paid; no withdrawal Payout exists.
    const paidPayouts = await prisma.payout.findMany({
      where: { operatorId, status: 'paid' },
      select: { id: true, net: true },
    });
    const totalDisbursed = paidPayouts.reduce((s, p) => s + p.net, BigInt(0));
    expect(totalDisbursed).toBe(BigInt(NET_NUM)); // NOT 2×NET

    const debits = await prisma.ledgerEntry.count({
      where: { operatorId, type: 'payout_debit' },
    });
    expect(debits).toBe(1);

    const bal = await getOperatorBalance(operatorId);
    expect(bal.paidOut).toBe(BigInt(NET_NUM));
    expect(bal.available).toBe(BigInt(0)); // never negative
    expect(paidPayouts.some((p) => p.id === autoPayoutId)).toBe(true);
  });
});
