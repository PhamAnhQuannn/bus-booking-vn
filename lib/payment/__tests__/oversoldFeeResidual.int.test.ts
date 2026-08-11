/**
 * Integration test — A-5 oversold auto-refund must leave the operator net ZERO
 * (money-flow audit 2026-08-11).
 *
 * BUG: on the oversold race (a second real payment arrives for the last seat),
 * processWebhook writes booking_credit +total AND platform_fee −fee, then the
 * post-commit refundOut('oversold_race') claws refund_debit −total → operator net
 * = −fee. The operator is penalised the platform fee for an oversell they did not
 * cause. (The reconcile path has a worse variant: it writes no credit at all →
 * net −total.) Correct behaviour: the operator earns and loses nothing → net 0.
 *
 * Drives the real webhook via the oversold path. `after` is captured + flushed so
 * the oversold refund actually runs. Asserts the oversold booking's operator net
 * is 0 (no platform_fee). FAILS on the buggy code (a −fee platform_fee remains).
 *
 * DB-gated — run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'crypto';

const { afterTasks } = vi.hoisted(() => ({ afterTasks: [] as Array<() => Promise<unknown>> }));
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: (task: () => Promise<unknown>) => { afterTasks.push(task); } };
});
const flushAfter = async () => { for (const t of afterTasks.splice(0)) await t(); };

import { prisma } from '@/lib/core/db/client';
import { processPaymentWebhook, getBankTransferAdapter } from '@/lib/payment';
import { generateBookingRef } from '@/lib/core/id';

const GROSS = 500_000;

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;
let paidBookingId: string; // pre-existing paid booking that fills the single seat
let oversoldBookingId: string; // the one the webhook pays → oversold → refunded
let oversoldRef: string;
let feeConfigId: string | null = null;

function sepayBody(ref: string, txnId: string): string {
  const memo = ref.replace(/-/g, '');
  return JSON.stringify({
    id: Number(txnId), gateway: 'Sacombank', transactionDate: '2026-08-11 14:01:13',
    accountNumber: '030976167267', subAccount: null, transferType: 'in',
    transferAmount: GROSS, accumulated: 0, code: null,
    content: `${memo} CKN 123456`, referenceCode: 'VN00OVS26204', description: `BankAPINotify ${memo}`,
  });
}

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: { legalName: 'Oversold Fee Op', contactPhone: '+8490xxxxxx6', contactEmail: 'oversoldfee@test.invalid', status: 'APPROVED' },
  });
  operatorId = op.id;
  // Capacity 1 — a single seat.
  const bus = await prisma.bus.create({ data: { operatorId, capacity: 1, licensePlate: 'TEST-OVSF-001', busType: 'coach' } });
  busId = bus.id;
  const route = await prisma.route.create({ data: { origin: 'OVSF Origin', destination: 'OVSF Destination', operatorId, durationMinutes: 120 } });
  routeId = route.id;
  const trip = await prisma.trip.create({
    data: { routeId, busId, operatorId, departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000), price: GROSS, status: 'scheduled', salesClosed: false },
  });
  tripId = trip.id;

  // Pre-existing PAID booking already fills the one seat.
  paidBookingId = randomUUID();
  await prisma.booking.create({
    data: {
      id: paidBookingId, bookingRef: generateBookingRef(), confirmationToken: randomUUID().replace(/-/g, '') + 'f1',
      tripId, buyerName: 'Seat Holder', buyerEmail: 'seatholder@test.invalid', buyerPhone: '+8490xxxxxx5',
      ticketCount: 1, totalVnd: GROSS, paymentMethod: 'bank_transfer', status: 'paid', paidAt: new Date(),
    },
  });

  // The booking the webhook will pay → 2 paid seats > capacity 1 → oversold → refunded.
  oversoldBookingId = randomUUID();
  oversoldRef = generateBookingRef();
  await prisma.booking.create({
    data: {
      id: oversoldBookingId, bookingRef: oversoldRef, confirmationToken: randomUUID().replace(/-/g, '') + 'f2',
      tripId, buyerName: 'Oversold Buyer', buyerEmail: 'oversoldbuyer@test.invalid', buyerPhone: '+8490xxxxxx4',
      ticketCount: 1, totalVnd: GROSS, paymentMethod: 'bank_transfer', status: 'awaiting_payment',
    },
  });

  const existing = await prisma.feeConfig.findFirst({ where: { operatorId: null, effectiveTo: null } });
  if (!existing) {
    const fc = await prisma.feeConfig.create({ data: { operatorId: null, ratePpm: 60000, effectiveFrom: new Date('2020-01-01T00:00:00Z') } });
    feeConfigId = fc.id;
  }
});

afterAll(async () => {
  const ids = [paidBookingId, oversoldBookingId];
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_update" ON "LedgerEntry"');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_delete" ON "LedgerEntry"');
  await prisma.ledgerEntry.deleteMany({ where: { operatorId } });
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_update" BEFORE UPDATE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_delete" BEFORE DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.paymentEvent.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.notificationLog.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  if (feeConfigId) await prisma.feeConfig.delete({ where: { id: feeConfigId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('A-5 — oversold refund leaves the operator net zero (no fee penalty)', () => {
  it('an oversold booking nets 0 for the operator — booking_credit offset by refund_debit, NO platform_fee', async () => {
    const res = await processPaymentWebhook({
      rawBody: sepayBody(oversoldRef, String(Date.now())),
      gateway: getBankTransferAdapter(),
      adapter: 'bank_transfer', proto: 'https', host: 'test.invalid',
    });
    expect(res.status).toBe(200);
    expect(afterTasks.length).toBe(1); // oversold refund captured
    await flushAfter();

    const booking = await prisma.booking.findUnique({ where: { id: oversoldBookingId }, select: { status: true } });
    expect(booking?.status).toBe('refunded');

    // The oversold booking's operator-balance-affecting entries must net to 0.
    const rows = await prisma.ledgerEntry.findMany({ where: { bookingId: oversoldBookingId }, select: { type: true, amount: true } });
    const OPERATOR_TYPES = new Set(['booking_credit', 'platform_fee', 'refund_debit', 'chargeback', 'adjustment', 'payout_reversal', 'tax_withheld']);
    const net = rows.filter((r) => OPERATOR_TYPES.has(r.type)).reduce((s, r) => s + r.amount, BigInt(0));
    expect(net).toBe(BigInt(0)); // BUG: −fee (processWebhook writes platform_fee)

    // No platform fee is earned on a fully-refunded oversold booking.
    const feeCount = rows.filter((r) => r.type === 'platform_fee').length;
    expect(feeCount).toBe(0);
    // The credit offsets the refund_debit.
    expect(rows.filter((r) => r.type === 'booking_credit').length).toBe(1);
    expect(rows.filter((r) => r.type === 'refund_debit').length).toBe(1);
  });
});
