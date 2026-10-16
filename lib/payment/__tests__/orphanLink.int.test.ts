/**
 * Integration test for #331 — admin links an orphan transfer to its held booking, and the
 * booking is confirmed paid through the EXISTING reconcile paid path exactly once.
 *
 * Against a real migrated DB:
 *   - a stuck bank_transfer booking (expired hold, > threshold) + an orphan SePay
 *     PaymentEvent of the exact fare inside the degraded-match window → the queue lists the
 *     orphan with the booking as a suspect
 *   - linkOrphanPayment + runJob('reconcile-payments') → booking `paid`, ONE booking_credit,
 *     ONE platform_fee, ONE customerBookingPaid notice; the orphan leaves the queue
 *   - replay (link again + sweep again) → replay:true, still exactly one of each
 *   - negative paths: already_linked (other booking), booking_not_awaiting_payment,
 *     amount_mismatch; resolveOrphanPayment on another orphan stamps it and a 2nd → not_resolvable
 *
 * DB-gated. Run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { runJob, reconcilePayments } from '@/lib/jobs';
import { linkOrphanPayment, resolveOrphanPayment } from '@/lib/payment';
import { getOrphanPaymentQueue } from '@/lib/admin';

const FARE = 163_331;
const tag = randomUUID().slice(0, 8);

let operatorId: string;
let routeId: string;
let tripId: string;
let feeConfigId: string | null = null;
const heldBookingId = randomUUID();
const otherBookingId = randomUUID();
const heldRef = `BB-2331-${tag}-held`;
const otherRef = `BB-2331-${tag}-other`;
const orphanId = randomUUID();
const wrongAmountOrphanId = randomUUID();
const resolveOrphanId = randomUUID();
const holdIds: string[] = [];

function sepayBody(amount: number): string {
  return JSON.stringify({
    gateway: 'TestBank',
    transferType: 'in',
    transferAmount: amount,
    content: 'CK khong ghi noi dung',
  });
}

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: { legalName: 'Orphan331 Test Op', contactPhone: '+8490xxxxxx1', contactEmail: 'orphan331@test.invalid' },
  });
  operatorId = op.id;
  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 40, licensePlate: `T331-${tag}`, busType: 'coach' },
  });
  const route = await prisma.route.create({
    data: { origin: '331 Origin', destination: '331 Destination', operatorId, durationMinutes: 90 },
  });
  routeId = route.id;
  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId: bus.id,
      operatorId,
      departureAt: new Date(Date.now() + 7 * 86_400_000),
      price: FARE,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  tripId = trip.id;

  const existing = await prisma.feeConfig.findFirst({ where: { operatorId: null, effectiveTo: null } });
  if (!existing) {
    feeConfigId = (
      await prisma.feeConfig.create({
        data: { operatorId: null, ratePpm: 60000, effectiveFrom: new Date('2020-01-01T00:00:00Z') },
      })
    ).id;
  }

  const stuckAt = new Date(Date.now() - 60 * 60_000);
  for (const [id, ref, phone] of [
    [heldBookingId, heldRef, '+8490xxxxxx2'],
    [otherBookingId, otherRef, '+8490xxxxxx3'],
  ] as const) {
    const hold = await prisma.hold.create({
      data: {
        tripId,
        ticketCount: 1,
        customerPhone: phone,
        customerName: 'Orphan Buyer',
        expiresAt: new Date(Date.now() - 30 * 60_000),
        status: 'expired',
        createdAt: stuckAt,
      },
    });
    holdIds.push(hold.id);
    await prisma.booking.create({
      data: {
        id,
        bookingRef: ref,
        confirmationToken: randomUUID().replace(/-/g, '') + ref.slice(-4),
        tripId,
        holdId: hold.id,
        buyerName: 'Orphan Buyer',
        buyerPhone: phone,
        buyerEmail: `${ref.toLowerCase()}@test.invalid`,
        ticketCount: 1,
        totalVnd: FARE,
        paymentMethod: 'bank_transfer',
        status: 'awaiting_payment',
        createdAt: stuckAt,
      },
    });
  }

  await prisma.paymentEvent.createMany({
    data: [
      {
        id: orphanId,
        bookingId: null,
        adapter: 'bank_transfer',
        providerTxnId: `int331-orphan-${tag}`,
        rawBody: sepayBody(FARE),
        receivedAt: new Date(stuckAt.getTime() + 5 * 60_000),
        unmatchedReason: 'no_booking_ref_in_memo',
      },
      {
        id: wrongAmountOrphanId,
        bookingId: null,
        adapter: 'bank_transfer',
        providerTxnId: `int331-wrong-${tag}`,
        rawBody: sepayBody(FARE - 1000),
        receivedAt: stuckAt,
        unmatchedReason: 'no_booking_ref_in_memo',
      },
      {
        id: resolveOrphanId,
        bookingId: null,
        adapter: 'bank_transfer',
        providerTxnId: `int331-resolve-${tag}`,
        rawBody: sepayBody(12_345),
        receivedAt: stuckAt,
        unmatchedReason: 'booking_not_found',
      },
    ],
  });
});

afterAll(async () => {
  const bookingIds = [heldBookingId, otherBookingId];
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_update" ON "LedgerEntry"');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_delete" ON "LedgerEntry"');
  await prisma.ledgerEntry.deleteMany({ where: { operatorId } });
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_update" BEFORE UPDATE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_delete" BEFORE DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.paymentEvent.deleteMany({ where: { id: { in: [orphanId, wrongAmountOrphanId, resolveOrphanId] } } });
  await prisma.notificationLog.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.refundObligation.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.hold.deleteMany({ where: { id: { in: holdIds } } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  if (feeConfigId) await prisma.feeConfig.delete({ where: { id: feeConfigId } });
  await prisma.$disconnect();
});

async function paidEffects(bookingId: string) {
  const [booking, ledger, notices] = await Promise.all([
    prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, select: { status: true, paidAt: true } }),
    prisma.ledgerEntry.findMany({ where: { bookingId }, select: { type: true } }),
    prisma.notificationLog.findMany({ where: { bookingId, template: 'customerBookingPaid' } }),
  ]);
  return { booking, ledgerTypes: ledger.map((l) => l.type).sort(), notices: notices.length };
}

describe('#331 — link an orphan transfer to its held booking', () => {
  it('lists the orphan with the held booking as a suspect', async () => {
    const rows = await getOrphanPaymentQueue();
    const row = rows.find((r) => r.id === orphanId);
    expect(row).toMatchObject({ amountVnd: FARE });
    expect(row?.suspectedBookings.map((b) => b.bookingRef)).toEqual(
      expect.arrayContaining([heldRef, otherRef])
    );
  });

  it('rejects an amount mismatch without linking', async () => {
    const res = await linkOrphanPayment({ paymentEventId: wrongAmountOrphanId, bookingRef: heldRef });
    expect(res).toEqual({ ok: false, error: 'amount_mismatch' });
    const ev = await prisma.paymentEvent.findUniqueOrThrow({ where: { id: wrongAmountOrphanId } });
    expect(ev.bookingId).toBeNull();
  });

  it('link + sweep → paid exactly once (ledger + notice), orphan leaves the queue', async () => {
    const res = await linkOrphanPayment({ paymentEventId: orphanId, bookingRef: heldRef });
    expect(res).toEqual({ ok: true, bookingId: heldBookingId, replay: false });
    await runJob('reconcile-payments', reconcilePayments);

    const fx = await paidEffects(heldBookingId);
    expect(fx.booking.status).toBe('paid');
    expect(fx.booking.paidAt).not.toBeNull();
    expect(fx.ledgerTypes).toEqual(['booking_credit', 'platform_fee']);
    expect(fx.notices).toBe(1);
    expect((await getOrphanPaymentQueue()).some((r) => r.id === orphanId)).toBe(false);
  });

  it('replay is safe: link again + sweep again → no second ledger/notice', async () => {
    const res = await linkOrphanPayment({ paymentEventId: orphanId, bookingRef: heldRef });
    expect(res).toEqual({ ok: true, bookingId: heldBookingId, replay: true });
    await runJob('reconcile-payments', reconcilePayments);

    const fx = await paidEffects(heldBookingId);
    expect(fx.booking.status).toBe('paid');
    expect(fx.ledgerTypes).toEqual(['booking_credit', 'platform_fee']);
    expect(fx.notices).toBe(1);
  });

  it('already_linked when the same orphan is aimed at a different booking', async () => {
    const res = await linkOrphanPayment({ paymentEventId: orphanId, bookingRef: otherRef });
    expect(res).toEqual({ ok: false, error: 'already_linked' });
  });

  it('booking_not_awaiting_payment for a booking that is already paid', async () => {
    await prisma.paymentEvent.update({ where: { id: wrongAmountOrphanId }, data: { rawBody: sepayBody(FARE) } });
    const res = await linkOrphanPayment({ paymentEventId: wrongAmountOrphanId, bookingRef: heldRef });
    expect(res).toEqual({ ok: false, error: 'booking_not_awaiting_payment' });
  });

  it('resolveOrphanPayment stamps the orphan once; a 2nd call and a link are refused', async () => {
    const now = new Date();
    expect(await resolveOrphanPayment({ paymentEventId: resolveOrphanId, bankRef: 'FT331', now })).toEqual({
      ok: true,
    });
    const ev = await prisma.paymentEvent.findUniqueOrThrow({ where: { id: resolveOrphanId } });
    expect(ev.resolvedAt).not.toBeNull();
    expect(ev.resolvedBankRef).toBe('FT331');
    expect(await resolveOrphanPayment({ paymentEventId: resolveOrphanId, bankRef: 'FT331', now })).toEqual({
      ok: false,
      error: 'not_resolvable',
    });
    expect((await getOrphanPaymentQueue()).some((r) => r.id === resolveOrphanId)).toBe(false);
  });
});
