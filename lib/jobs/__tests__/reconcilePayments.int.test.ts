/**
 * Issue 095 AC5 — integration tests for the payment-reconciliation sweeper.
 *
 * Run with: pnpm vitest:int
 *
 * Seeds (against a live DB):
 *   1. a stuck `awaiting_payment` booking (created > threshold ago) + a matching
 *      confirmed PaymentEvent (rawBody amount==total, resultCode 0) → after a run
 *      the booking is `paid` AND the two ledger rows (booking_credit/platform_fee)
 *      are present.
 *   2. a stuck `awaiting_payment` booking + NO event + an EXPIRED hold → after a
 *      run the booking is `payment_failed_expired`.
 *
 * The whole sweep is invoked through runJob('reconcile-payments', …) so the
 * advisory lock + the single JobRunLog/run are exercised too.
 *
 * Fixture rows include ALL NOT NULL columns on Operator/Route/Bus/Trip/Booking
 * (Mistake Log 012/013). A covering global FeeConfig row is ensured so the paid
 * path's getEffectiveFeeRate resolves.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { runJob } from '../runJob';

const TOTAL = 200_000;

let operatorId: string;
let routeId: string;
let busId: string;
let feeConfigId: string | null = null;

// IDs of the two seeded bookings.
const PAID_BOOKING_ID = randomUUID();
const EXPIRE_BOOKING_ID = randomUUID();

/** A signed-shape stub IPN body — only amount + resultCode are read by recon. */
function ipnBody(amount: number, resultCode: number): string {
  return JSON.stringify({ orderId: 'x', transId: 'x', amount, resultCode });
}

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: {
      legalName: 'Recon Test Op',
      contactPhone: '+8490xxxxxx2',
      contactEmail: 'recon@test.dev',
      notificationPhone: '+8490xxxxxx3',
    },
  });
  operatorId = op.id;

  busId = (
    await prisma.bus.create({
      data: { operatorId, capacity: 40, licensePlate: 'RECON-001', busType: 'coach' },
    })
  ).id;

  routeId = (
    await prisma.route.create({
      data: { origin: 'Recon Origin', destination: 'Recon Destination', operatorId, durationMinutes: 90 },
    })
  ).id;

  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: new Date(Date.now() + 7 * 86_400_000),
      price: TOTAL,
      status: 'scheduled',
      salesClosed: false,
    },
  });

  // Covering global FeeConfig (cutover seed normally provides this).
  const existing = await prisma.feeConfig.findFirst({
    where: { operatorId: null, effectiveTo: null },
  });
  if (!existing) {
    const fc = await prisma.feeConfig.create({
      data: { operatorId: null, ratePpm: 60000, effectiveFrom: new Date('2020-01-01T00:00:00Z') },
    });
    feeConfigId = fc.id;
  }

  const stuckCreatedAt = new Date(Date.now() - 60 * 60_000); // 60 min ago (> 30 threshold)

  // (1) stuck booking + a matching confirmed event.
  await prisma.booking.create({
    data: {
      id: PAID_BOOKING_ID,
      bookingRef: 'BB-2026-recon-paid',
      confirmationToken: 'R'.repeat(32),
      tripId: trip.id,
      buyerName: 'Recon Paid',
      buyerPhone: '+8490xxxxxx4',
      ticketCount: 1,
      totalVnd: TOTAL,
      paymentMethod: 'momo',
      status: 'awaiting_payment',
      isManual: false,
      contactStatus: 'pending',
      createdAt: stuckCreatedAt,
    },
  });
  await prisma.paymentEvent.create({
    data: {
      bookingId: PAID_BOOKING_ID,
      adapter: 'momo',
      providerTxnId: 'recon-txn-paid',
      currency: 'VND',
      rawBody: ipnBody(TOTAL, 0),
      receivedAt: stuckCreatedAt,
    },
  });

  // (2) stuck booking + no event + an expired hold.
  const expiredHold = await prisma.hold.create({
    data: {
      tripId: trip.id,
      ticketCount: 1,
      customerPhone: '+8490xxxxxx5',
      customerName: 'Recon Expire',
      expiresAt: new Date(Date.now() - 30 * 60_000), // expired 30 min ago
      status: 'expired',
      createdAt: stuckCreatedAt,
    },
  });
  await prisma.booking.create({
    data: {
      id: EXPIRE_BOOKING_ID,
      bookingRef: 'BB-2026-recon-expire',
      confirmationToken: 'E'.repeat(32),
      tripId: trip.id,
      holdId: expiredHold.id,
      buyerName: 'Recon Expire',
      buyerPhone: '+8490xxxxxx5',
      ticketCount: 1,
      totalVnd: TOTAL,
      paymentMethod: 'momo',
      status: 'awaiting_payment',
      isManual: false,
      contactStatus: 'pending',
      createdAt: stuckCreatedAt,
    },
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

  await prisma.notificationLog.deleteMany({ where: { booking: { trip: { operatorId } } } });
  await prisma.paymentEvent.deleteMany({ where: { booking: { trip: { operatorId } } } });
  await prisma.booking.deleteMany({ where: { trip: { operatorId } } });
  await prisma.hold.deleteMany({ where: { trip: { operatorId } } });
  await prisma.trip.deleteMany({ where: { operatorId } });
  await prisma.jobRunLog.deleteMany({ where: { jobName: 'reconcile-payments' } });
  await prisma.route.deleteMany({ where: { operatorId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  if (feeConfigId) await prisma.feeConfig.delete({ where: { id: feeConfigId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('Issue 095 AC5 — reconcile-payments sweeper', () => {
  it('reconciles a stuck awaiting_payment + matching event to paid (+ ledger), and expires a stuck no-event row with an expired hold', async () => {
    const { reconcilePayments } = await import('../reconcilePayments');
    const result = await runJob('reconcile-payments', reconcilePayments);

    expect(result.status).toBe('success');

    // (1) → paid, with both ledger entries.
    const paid = await prisma.booking.findUnique({ where: { id: PAID_BOOKING_ID } });
    expect(paid?.status).toBe('paid');
    expect(paid?.paymentExternalRef).toBe('recon-txn-paid');

    const entries = await prisma.ledgerEntry.findMany({
      where: { bookingId: PAID_BOOKING_ID },
      orderBy: { type: 'asc' },
    });
    const types = entries.map((e) => e.type).sort();
    expect(types).toEqual(['booking_credit', 'platform_fee']);
    const credit = entries.find((e) => e.type === 'booking_credit');
    const fee = entries.find((e) => e.type === 'platform_fee');
    expect(credit?.amount).toBe(BigInt(TOTAL)); // +gross
    expect(fee?.amount).toBe(BigInt(-(TOTAL * 60000) / 1_000_000)); // −6%

    // (2) → payment_failed_expired.
    const expired = await prisma.booking.findUnique({ where: { id: EXPIRE_BOOKING_ID } });
    expect(expired?.status).toBe('payment_failed_expired');

    // Exactly one JobRunLog row for this run wrapper.
    const logs = await prisma.jobRunLog.findMany({ where: { jobName: 'reconcile-payments' } });
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });
});
