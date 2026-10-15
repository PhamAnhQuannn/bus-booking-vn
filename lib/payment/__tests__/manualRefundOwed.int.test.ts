/**
 * Integration test for #833 step 2 + #851 — owed money is tracked until an admin closes it.
 *
 * The PSP refund is forced onto the no-PSP manual rail (prod behaviour) by mocking
 * refundPayment. Asserts against a real migrated DB:
 *   - processRefunds on a manual refund leaves the obligation 'manual_pending' (not 'done'),
 *     with the ledger legs written, and it shows in the admin owed queue
 *   - a direct refundOut caller with no obligation row (admin refund-out) gets one created
 *   - markManualRefundPaid → 'done' + manualPaidAt + manualBankRef; a 2nd mark → not_owed;
 *     the cron never reclaims it
 *   - resolveUnfulfilledPayment stamps resolvedAt on a linked unfulfilled PaymentEvent and
 *     drops it from the queue; a 2nd resolve → not_resolvable; an orphan → not_resolvable
 *
 * DB-gated — runs in CI against a fresh migrated DB. Run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'crypto';

vi.mock('@/lib/payment/refund', () => ({
  refundPayment: vi.fn(async () => ({ ok: false, manualRefundRequired: true })),
}));

import { prisma } from '@/lib/core/db/client';
import { appendLedgerEntry } from '@/lib/ledger';
import { processRefunds } from '@/lib/jobs';
import { refundOut, markManualRefundPaid, resolveUnfulfilledPayment } from '@/lib/payment';
import { getManualRefundQueue } from '@/lib/admin';

let operatorId: string;
let routeId: string;
let bookingId: string;
const unfulfilledEventId = randomUUID();
const orphanEventId = randomUUID();
const GROSS = 200_000;
const CRON_KEY = `cancel:int833:${randomUUID()}`;
const ADMIN_KEY = `admin-refund:${randomUUID()}`;

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: { legalName: 'Owed833 Test Op', contactPhone: '+8490xxxxxx7', contactEmail: 'owed833@test.invalid' },
  });
  operatorId = op.id;
  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 10, licensePlate: 'TEST-833-001', busType: 'coach' },
  });
  const route = await prisma.route.create({
    data: { origin: '833 Origin', destination: '833 Destination', operatorId, durationMinutes: 120 },
  });
  routeId = route.id;
  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId: bus.id,
      operatorId,
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      price: GROSS,
      status: 'scheduled',
      salesClosed: false,
    },
  });

  bookingId = randomUUID();
  await prisma.booking.create({
    data: {
      id: bookingId,
      bookingRef: `BB-2833-${randomUUID().slice(0, 4)}-o833`,
      confirmationToken: randomUUID().replace(/-/g, '') + 'o8',
      tripId: trip.id,
      buyerName: 'Owed Buyer',
      buyerPhone: '+8490xxxxxx5',
      ticketCount: 1,
      totalVnd: GROSS,
      paymentMethod: 'bank_transfer',
      paymentExternalRef: 'sepay_inbound_833',
      status: 'paid',
    },
  });
  await appendLedgerEntry({
    operatorId,
    bookingId,
    type: 'booking_credit',
    amountMinor: BigInt(GROSS),
    sourceEventId: `booking_credit:${bookingId}`,
  });

  await prisma.refundObligation.create({
    data: {
      bookingId,
      amountMinor: 50_000,
      reason: 'operator_cancel',
      idempotencyKey: CRON_KEY,
      providerTxnId: 'sepay_inbound_833',
    },
  });

  await prisma.paymentEvent.createMany({
    data: [
      {
        id: unfulfilledEventId,
        bookingId,
        adapter: 'bank_transfer',
        providerTxnId: `int833-dup-${unfulfilledEventId}`,
        rawBody: '{}',
        unmatchedReason: 'duplicate_booking_paid',
      },
      {
        id: orphanEventId,
        bookingId: null,
        adapter: 'bank_transfer',
        providerTxnId: `int833-orphan-${orphanEventId}`,
        rawBody: '{}',
        unmatchedReason: 'no_booking_ref_in_memo',
      },
    ],
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
  await prisma.paymentEvent.deleteMany({ where: { id: { in: [unfulfilledEventId, orphanEventId] } } });
  await prisma.notificationLog.deleteMany({ where: { bookingId } });
  await prisma.refundObligation.deleteMany({ where: { bookingId } });
  await prisma.booking.deleteMany({ where: { id: bookingId } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('#833 — manual refunds stay owed until an admin marks them paid', () => {
  it('processRefunds on the manual rail writes the ledger legs but leaves the row manual_pending', async () => {
    await processRefunds({} as never, { now: new Date() });

    const ob = await prisma.refundObligation.findUniqueOrThrow({ where: { idempotencyKey: CRON_KEY } });
    expect(ob.status).toBe('manual_pending');
    expect(ob.manualPaidAt).toBeNull();
    expect(
      await prisma.ledgerEntry.findUnique({ where: { sourceEventId: `refund_out:${CRON_KEY}` } })
    ).not.toBeNull();

    const q = await getManualRefundQueue();
    expect(q.refunds.map((r) => r.id)).toContain(ob.id);
  });

  it('a direct refundOut caller with no obligation row (admin refund-out) gets one created as owed', async () => {
    const res = await refundOut({ bookingId, amountMinor: 30_000, reason: 'operator_cancel', idempotencyKey: ADMIN_KEY });
    expect(res.manualRefundRequired).toBe(true);
    const ob = await prisma.refundObligation.findUniqueOrThrow({ where: { idempotencyKey: ADMIN_KEY } });
    expect(ob).toMatchObject({ status: 'manual_pending', amountMinor: 30_000, bookingId });
  });

  it('markManualRefundPaid closes it once; a 2nd mark is not_owed; the cron does not reclaim it', async () => {
    const ob = await prisma.refundObligation.findUniqueOrThrow({ where: { idempotencyKey: CRON_KEY } });
    const now = new Date();

    expect(await markManualRefundPaid({ obligationId: ob.id, bankRef: 'FT26287001', now })).toEqual({ ok: true });
    const after = await prisma.refundObligation.findUniqueOrThrow({ where: { id: ob.id } });
    expect(after).toMatchObject({ status: 'done', manualBankRef: 'FT26287001' });
    expect(after.manualPaidAt).not.toBeNull();

    expect(await markManualRefundPaid({ obligationId: ob.id, bankRef: 'FT2', now })).toEqual({
      ok: false,
      error: 'not_owed',
    });
    expect(await markManualRefundPaid({ obligationId: 'does-not-exist', bankRef: 'FT2', now })).toEqual({
      ok: false,
      error: 'not_found',
    });

    await processRefunds({} as never, { now: new Date() });
    expect((await prisma.refundObligation.findUniqueOrThrow({ where: { id: ob.id } })).status).toBe('done');
    const q = await getManualRefundQueue();
    expect(q.refunds.map((r) => r.id)).not.toContain(ob.id);
  });
});

describe('#851 — unfulfilled linked transfers get a resolved state', () => {
  it('lists the unresolved event, resolves it once, then drops it from the queue', async () => {
    const before = await getManualRefundQueue();
    expect(before.payments.map((p) => p.id)).toContain(unfulfilledEventId);

    const now = new Date();
    expect(
      await resolveUnfulfilledPayment({ paymentEventId: unfulfilledEventId, bankRef: 'FT26287002', now })
    ).toEqual({ ok: true });
    const ev = await prisma.paymentEvent.findUniqueOrThrow({ where: { id: unfulfilledEventId } });
    expect(ev.resolvedBankRef).toBe('FT26287002');
    expect(ev.resolvedAt).not.toBeNull();

    expect(
      await resolveUnfulfilledPayment({ paymentEventId: unfulfilledEventId, bankRef: 'FT3', now })
    ).toEqual({ ok: false, error: 'not_resolvable' });

    const after = await getManualRefundQueue();
    expect(after.payments.map((p) => p.id)).not.toContain(unfulfilledEventId);
  });

  it('an orphan event is not resolvable here; a missing id is not_found', async () => {
    const now = new Date();
    expect(await resolveUnfulfilledPayment({ paymentEventId: orphanEventId, bankRef: 'FT4', now })).toEqual({
      ok: false,
      error: 'not_resolvable',
    });
    expect(await resolveUnfulfilledPayment({ paymentEventId: randomUUID(), bankRef: 'FT4', now })).toEqual({
      ok: false,
      error: 'not_found',
    });
  });
});
