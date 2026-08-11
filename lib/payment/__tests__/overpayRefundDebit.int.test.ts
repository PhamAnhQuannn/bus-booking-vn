/**
 * Integration test — P0-3 overpay refund wrongly debits the operator
 * (money-flow audit 2026-08-11).
 *
 * BUG: on a bank-transfer OVERPAYMENT the operator is credited only the fare
 * (`booking_credit = +totalVnd`); the overpaid delta is platform float, never
 * operator revenue. But refundOut writes BOTH a `refund_out` (platform float) AND
 * a `refund_debit` (which COUNTS toward operator balance) for every reason — so
 * refunding the overpay silently reduces the operator's balance by the delta, for
 * money they were never credited.
 *
 * FIX: for `reason: 'overpay_difference'`, write ONLY the `refund_out` leg.
 *
 * These assertions encode the CORRECT (post-fix) behaviour → FAIL on the buggy
 * code (a refund_debit is present, operator balance drops), pass after the fix.
 *
 * DB-gated — run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { appendLedgerEntry } from '@/lib/ledger';
import { getOperatorBalance } from '@/lib/ledger';
import { refundOut } from '../refundOut';

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;
let bookingId: string;

const GROSS = 500_000; // fare
const FEE = 30_000; // 6%
const NET = GROSS - FEE; // 470_000 operator available for this settled trip
const OVERPAY = 50_000; // customer transferred GROSS + 50_000

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: { legalName: 'Overpay Refund Op', contactPhone: '+8490xxxxxx3', contactEmail: 'overpay@test.invalid' },
  });
  operatorId = op.id;
  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 20, licensePlate: 'TEST-OVP-001', busType: 'coach' },
  });
  busId = bus.id;
  const route = await prisma.route.create({
    data: { origin: 'OVP Origin', destination: 'OVP Destination', operatorId, durationMinutes: 300 },
  });
  routeId = route.id;
  // Completed + past T+1 so the credit/fee are settlement-eligible (available).
  const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const trip = await prisma.trip.create({
    data: { routeId, busId, operatorId, departureAt: past, price: GROSS, status: 'completed', salesClosed: true, completedAt: past },
  });
  tripId = trip.id;
  bookingId = randomUUID();
  await prisma.booking.create({
    data: {
      id: bookingId,
      bookingRef: `BB-2003-${randomUUID().slice(0, 4)}-ovp1`,
      confirmationToken: randomUUID().replace(/-/g, '') + 'ov',
      tripId,
      buyerName: 'Overpay Buyer',
      buyerEmail: 'overpaybuyer@test.invalid',
      buyerPhone: '+8490xxxxxx2',
      ticketCount: 1,
      totalVnd: GROSS,
      paymentMethod: 'bank_transfer',
      paymentExternalRef: 'stub_inbound_txn_ovp',
      status: 'paid',
    },
  });
  // The paid transition credited the operator the FARE only (not the overpay).
  await appendLedgerEntry({ operatorId, bookingId, type: 'booking_credit', amountMinor: BigInt(GROSS), sourceEventId: `booking_credit:${bookingId}` });
  await appendLedgerEntry({ operatorId, bookingId, type: 'platform_fee', amountMinor: BigInt(-FEE), sourceEventId: `platform_fee:${bookingId}` });
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
  await prisma.notificationLog.deleteMany({ where: { bookingId } });
  await prisma.booking.deleteMany({ where: { id: bookingId } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('P0-3 — overpay refund must not debit the operator', () => {
  it('refunds the overpay via refund_out ONLY, leaving the operator balance intact', async () => {
    const before = await getOperatorBalance(operatorId);
    expect(before.available).toBe(BigInt(NET));

    const res = await refundOut({
      bookingId,
      amountMinor: OVERPAY,
      reason: 'overpay_difference',
      idempotencyKey: `overpay:${bookingId}:txn-ovp`,
    });
    expect(res.refunded).toBe(true);

    // Platform-float leg written; NO operator clawback for money never credited.
    const refundOutCount = await prisma.ledgerEntry.count({ where: { bookingId, type: 'refund_out' } });
    const refundDebitCount = await prisma.ledgerEntry.count({ where: { bookingId, type: 'refund_debit' } });
    expect(refundOutCount).toBe(1);
    expect(refundDebitCount).toBe(0); // BUG: currently writes a −OVERPAY refund_debit

    // Operator balance is unchanged (they keep the full fare credit).
    const after = await getOperatorBalance(operatorId);
    expect(after.available).toBe(BigInt(NET));
  });
});
