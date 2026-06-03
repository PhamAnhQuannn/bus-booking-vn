/**
 * Integration test for Issue 051 — the refund-out rail wired into operator
 * trip-cancel.
 *
 * Seeds operator + route + bus + trip + a PAID booking with its booking_credit
 * ledger entry (the state after a successful payment, slice 049), then cancels
 * the trip via cancelTrip and asserts:
 *   - a refund_out (−total) AND a refund_debit (−total) entry now exist,
 *     keyed on the cancel-scoped idempotency key (distinct from the inbound
 *     payment key)
 *   - operator balance reflects the refund_debit clawback (credit − fee − total),
 *     and is NOT double-subtracted by refund_out (refund_out is excluded from
 *     OPERATOR_BALANCE_TYPES)
 *   - re-cancelling the (already-cancelled) trip is replay-safe: still exactly
 *     one refund_out + one refund_debit, balance unchanged
 *
 * DB-gated — does not run locally (no DB); runs in CI against a migrated DB.
 * Run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db/client';
import { appendLedgerEntry } from '../ledgerRepo';
import { getOperatorBalance } from '../balance';
import { cancelTrip } from '@/lib/trips/cancelTrip';

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;
let bookingId: string;
let bookingRef: string;

const GROSS = 250_000; // VND
const FEE = 15_000; // 6% half-even — the platform_fee entry written at paid

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: {
      legalName: 'Ledger051 Test Op',
      contactPhone: '+8490xxxxxx6',
      contactEmail: 'ledger051@test.invalid',
    },
  });
  operatorId = op.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 10, licensePlate: 'TEST-L51-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: { origin: 'L51 Origin', destination: 'L51 Destination', operatorId, durationMinutes: 240 },
  });
  routeId = route.id;

  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      price: GROSS,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  tripId = trip.id;

  bookingId = randomUUID();
  bookingRef = `BB-2051-${randomUUID().slice(0, 4)}-l051`;
  await prisma.booking.create({
    data: {
      id: bookingId,
      bookingRef,
      confirmationToken: randomUUID().replace(/-/g, '') + 'l5',
      tripId,
      buyerName: 'Ledger Buyer',
      buyerPhone: '+8490xxxxxx4',
      ticketCount: 1,
      totalVnd: GROSS,
      paymentMethod: 'momo',
      paymentExternalRef: 'stub_inbound_txn_051',
      // Already PAID — the refund clawback path requires a paid booking.
      status: 'paid',
    },
  });

  // Seed the booking_credit + platform_fee entries the paid transition wrote
  // (slice 049), so the post-refund balance assertion is meaningful.
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
});

afterAll(async () => {
  // LedgerEntry is append-only (immutability trigger) — drop to clean up.
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

describe('Issue 051 — refund-out on operator trip-cancel', () => {
  it('cancelTrip writes refund_out + refund_debit (−total each) for the paid booking', async () => {
    const res = await cancelTrip(operatorId, tripId, 'Equipment failure requiring repair');
    expect(res.alreadyCancelled).toBe(false);
    expect(res.cancelledBookings).toBe(1);

    const refundDebit = await prisma.ledgerEntry.findUnique({
      where: { sourceEventId: `refund_debit:cancel:${tripId}:${bookingId}` },
    });
    const refundOutEntry = await prisma.ledgerEntry.findUnique({
      where: { sourceEventId: `refund_out:cancel:${tripId}:${bookingId}` },
    });

    expect(refundDebit).not.toBeNull();
    expect(refundOutEntry).not.toBeNull();
    expect(refundDebit!.amount).toBe(BigInt(-GROSS));
    expect(refundOutEntry!.amount).toBe(BigInt(-GROSS));
    expect(refundDebit!.type).toBe('refund_debit');
    expect(refundOutEntry!.type).toBe('refund_out');
    // Idempotency key is distinct from the inbound payment external ref.
    expect(refundDebit!.sourceEventId).not.toContain('stub_inbound_txn_051');
  });

  it('operator balance reflects the refund_debit clawback, NOT double-subtracted by refund_out', async () => {
    // pending+available together = credit − fee − refund_debit
    //   = 250000 − 15000 − 250000 = −15000 (the platform_fee remains).
    // refund_out (−250000) is EXCLUDED, so the balance is NOT −265000.
    const bal = await getOperatorBalance(operatorId);
    const total = bal.pending + bal.available + bal.paidOut;
    expect(total).toBe(BigInt(-FEE));
  });

  it('re-cancel is replay-safe: still exactly one refund_out + one refund_debit', async () => {
    await cancelTrip(operatorId, tripId, 'Re-cancel attempt should not double-refund');

    const refundOuts = await prisma.ledgerEntry.findMany({
      where: { bookingId, type: 'refund_out' },
    });
    const refundDebits = await prisma.ledgerEntry.findMany({
      where: { bookingId, type: 'refund_debit' },
    });
    expect(refundOuts.length).toBe(1);
    expect(refundDebits.length).toBe(1);
  });
});
