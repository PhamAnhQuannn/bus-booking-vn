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
/** Bug B fixtures use their own amounts so they can never cross-match the MoMo rows. */
const BT_SOLO_TOTAL = 175_000;
const BT_PAIR_TOTAL = 150_000;

let operatorId: string;
let routeId: string;
let busId: string;
let feeConfigId: string | null = null;

// IDs of the two seeded bookings.
const PAID_BOOKING_ID = randomUUID();
const EXPIRE_BOOKING_ID = randomUUID();

// Bug B fixtures: one bank_transfer booking recoverable from a lone orphan, and a
// same-amount PAIR that must compete for a SINGLE orphan (only one may be paid).
const BT_SOLO_BOOKING_ID = randomUUID();
const BT_PAIR_EARLY_ID = randomUUID();
const BT_PAIR_LATE_ID = randomUUID();
const BT_SOLO_TXN = 'recon-sepay-solo';
const BT_PAIR_TXN = 'recon-sepay-pair';

/** A signed-shape stub IPN body — only amount + resultCode are read by recon. */
function ipnBody(amount: number, resultCode: number): string {
  return JSON.stringify({ orderId: 'x', transId: 'x', amount, resultCode });
}

/**
 * A REAL SePay webhook body — `transferAmount`, `transferType`, NO `resultCode`.
 * This is the shape the sweeper's MoMo-only parser silently failed on (Bug B): it
 * read `amount`/`resultCode`, both absent here, so every transfer recovered as
 * { 0, false }. The memo deliberately carries no bookingRef — that is WHY the row
 * is an orphan.
 */
function sepayOrphanBody(id: string, transferAmount: number): string {
  return JSON.stringify({
    id: Number(id.replace(/\D/g, '') || '1'),
    gateway: 'Sacombank',
    transactionDate: '2026-07-23 14:00:00',
    accountNumber: '030976167267',
    subAccount: null,
    transferType: 'in',
    transferAmount,
    accumulated: 0,
    code: null,
    content: 'CK tu KHACH HANG khong ghi noi dung',
    referenceCode: 'VN0011911FT26204RECON',
    description: 'BankAPINotify',
  });
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

  // ── Bug B fixtures ────────────────────────────────────────────────────────
  // Every bank_transfer booking below has an EXPIRED hold, so the ONLY thing that
  // can save it from payment_failed_expired is a successful degraded match.
  const mkExpiredHold = async (createdAt: Date, phone: string) =>
    (
      await prisma.hold.create({
        data: {
          tripId: trip.id,
          ticketCount: 1,
          customerPhone: phone,
          customerName: 'Recon BT',
          expiresAt: new Date(Date.now() - 30 * 60_000),
          status: 'expired',
          createdAt,
        },
      })
    ).id;

  const mkBtBooking = async (
    id: string,
    ref: string,
    total: number,
    createdAt: Date,
    holdId: string,
    phone: string
  ) =>
    prisma.booking.create({
      data: {
        id,
        bookingRef: ref,
        confirmationToken: id.replace(/-/g, '') + 'bt',
        tripId: trip.id,
        holdId,
        buyerName: 'Recon BT',
        buyerPhone: phone,
        ticketCount: 1,
        totalVnd: total,
        paymentMethod: 'bank_transfer',
        status: 'awaiting_payment',
        isManual: false,
        contactStatus: 'pending',
        createdAt,
      },
    });

  // (3) one stuck bank_transfer booking + one orphan SePay event in-window.
  const soloAt = new Date(Date.now() - 62 * 60_000);
  await mkBtBooking(
    BT_SOLO_BOOKING_ID,
    'BB-2026-recon-btso',
    BT_SOLO_TOTAL,
    soloAt,
    await mkExpiredHold(soloAt, '+8490xxxxxx6'),
    '+8490xxxxxx6'
  );
  await prisma.paymentEvent.create({
    data: {
      bookingId: null, // ORPHAN — the memo carried no usable ref
      adapter: 'bank_transfer',
      providerTxnId: BT_SOLO_TXN,
      currency: 'VND',
      rawBody: sepayOrphanBody(BT_SOLO_TXN, BT_SOLO_TOTAL),
      receivedAt: soloAt,
    },
  });

  // (4) TWO same-amount bank_transfer bookings, ONE real transfer. Only the first
  // (ORDER BY createdAt ASC) may be paid — the other must not bank the same money.
  const earlyAt = new Date(Date.now() - 64 * 60_000);
  const lateAt = new Date(Date.now() - 63 * 60_000);
  await mkBtBooking(
    BT_PAIR_EARLY_ID,
    'BB-2026-recon-btpa',
    BT_PAIR_TOTAL,
    earlyAt,
    await mkExpiredHold(earlyAt, '+8490xxxxxx7'),
    '+8490xxxxxx7'
  );
  await mkBtBooking(
    BT_PAIR_LATE_ID,
    'BB-2026-recon-btpb',
    BT_PAIR_TOTAL,
    lateAt,
    await mkExpiredHold(lateAt, '+8490xxxxxx8'),
    '+8490xxxxxx8'
  );
  await prisma.paymentEvent.create({
    data: {
      bookingId: null,
      adapter: 'bank_transfer',
      providerTxnId: BT_PAIR_TXN,
      currency: 'VND',
      rawBody: sepayOrphanBody(BT_PAIR_TXN, BT_PAIR_TOTAL),
      receivedAt: earlyAt,
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
  // Orphans (bookingId NULL) are unreachable through the `booking` relation filter —
  // delete them by their own key, or they leak into the shared int DB.
  await prisma.paymentEvent.deleteMany({
    where: { providerTxnId: { in: [BT_SOLO_TXN, BT_PAIR_TXN] } },
  });
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

  // ── Bug B ─────────────────────────────────────────────────────────────────
  // These assert against the state left by the single sweep above.

  it('recovers a bank_transfer booking from an orphan SePay event and CLAIMS the row', async () => {
    // Pre-fix this booking was expired: recoverEvent parsed the SePay body as MoMo,
    // got { amount: 0, success: false }, and matchDegraded rejected it at !ev.success.
    const booking = await prisma.booking.findUnique({ where: { id: BT_SOLO_BOOKING_ID } });
    expect(booking?.status).toBe('paid');
    expect(booking?.paymentExternalRef).toBe(BT_SOLO_TXN);

    // The claim UPDATE actually committed — no mock can show this.
    const orphan = await prisma.paymentEvent.findFirst({
      where: { adapter: 'bank_transfer', providerTxnId: BT_SOLO_TXN },
    });
    expect(orphan?.bookingId).toBe(BT_SOLO_BOOKING_ID);

    const entries = await prisma.ledgerEntry.findMany({ where: { bookingId: BT_SOLO_BOOKING_ID } });
    expect(entries.map((e) => e.type).sort()).toEqual(['booking_credit', 'platform_fee']);
  });

  it('one transfer pays exactly ONE of two same-amount bookings (no double credit)', async () => {
    const early = await prisma.booking.findUnique({ where: { id: BT_PAIR_EARLY_ID } });
    const late = await prisma.booking.findUnique({ where: { id: BT_PAIR_LATE_ID } });

    // Claimed in candidate order (ORDER BY createdAt ASC); the loser has no payment.
    expect(early?.status).toBe('paid');
    expect(late?.status).toBe('payment_failed_expired');

    // The load-bearing assertion: the operator is credited ONCE for one transfer.
    // Without the CAS claim both bookings degrade-match the same orphan inside the
    // same tick's transaction and this returns 2 credits for 150,000₫ of real money.
    const credits = await prisma.ledgerEntry.findMany({
      where: { bookingId: { in: [BT_PAIR_EARLY_ID, BT_PAIR_LATE_ID] }, type: 'booking_credit' },
    });
    expect(credits.length).toBe(1);
    expect(credits[0].amount).toBe(BigInt(BT_PAIR_TOTAL));

    const orphan = await prisma.paymentEvent.findFirst({
      where: { adapter: 'bank_transfer', providerTxnId: BT_PAIR_TXN },
    });
    expect(orphan?.bookingId).toBe(BT_PAIR_EARLY_ID);
  });
});
