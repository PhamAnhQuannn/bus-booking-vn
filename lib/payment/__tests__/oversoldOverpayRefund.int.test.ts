/**
 * Integration test — #515: an oversold booking that was ALSO overpaid must refund BOTH
 * the fare (oversold clawback) AND the overpay delta (platform float).
 *
 * BUG (money-flow audit review): the overpay-refund capture was guarded by
 * `!refundTriggered`, so on the oversold race it was skipped and only `totalVnd` (the
 * fare) was refunded via the oversold path. The overpaid difference (amount − totalVnd)
 * was silently kept as platform float — the rider lost money on a seat they never got.
 *
 * FIX: fire the overpay refund even when oversold. The oversold refund claws the FARE off
 * the operator (refund_debit); the overpay delta is platform float ('overpay_difference' →
 * no operator clawback). Both run → the rider is refunded the full `amount` they paid, and
 * the operator still nets 0.
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
const OVERPAY = 50_000;
const AMOUNT = GROSS + OVERPAY; // 550_000 transferred → overpaid AND oversold

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;
let paidBookingId: string;
let oversoldBookingId: string;
let oversoldRef: string;
let feeConfigId: string | null = null;

function sepayBody(ref: string, txnId: string): string {
  const memo = ref.replace(/-/g, '');
  return JSON.stringify({
    id: Number(txnId), gateway: 'Sacombank', transactionDate: '2026-08-11 14:01:13',
    accountNumber: '030976167267', subAccount: null, transferType: 'in',
    transferAmount: AMOUNT, accumulated: 0, code: null,
    content: `${memo} CKN 123456`, referenceCode: 'VN00OVO26204', description: `BankAPINotify ${memo}`,
  });
}

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: { legalName: 'Oversold Overpay Op', contactPhone: '+8490xxxxxx6', contactEmail: 'oversoldoverpay@test.invalid', status: 'APPROVED' },
  });
  operatorId = op.id;
  const bus = await prisma.bus.create({ data: { operatorId, capacity: 1, licensePlate: 'TEST-OVSO-001', busType: 'coach' } });
  busId = bus.id;
  const route = await prisma.route.create({ data: { origin: 'OVSO Origin', destination: 'OVSO Destination', operatorId, durationMinutes: 120 } });
  routeId = route.id;
  const trip = await prisma.trip.create({
    data: { routeId, busId, operatorId, departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000), price: GROSS, status: 'scheduled', salesClosed: false },
  });
  tripId = trip.id;

  paidBookingId = randomUUID();
  await prisma.booking.create({
    data: {
      id: paidBookingId, bookingRef: generateBookingRef(), confirmationToken: randomUUID().replace(/-/g, '') + 'o1',
      tripId, buyerName: 'Seat Holder', buyerEmail: 'seatholder2@test.invalid', buyerPhone: '+8490xxxxxx5',
      ticketCount: 1, totalVnd: GROSS, paymentMethod: 'bank_transfer', status: 'paid', paidAt: new Date(),
    },
  });

  oversoldBookingId = randomUUID();
  oversoldRef = generateBookingRef();
  await prisma.booking.create({
    data: {
      id: oversoldBookingId, bookingRef: oversoldRef, confirmationToken: randomUUID().replace(/-/g, '') + 'o2',
      tripId, buyerName: 'Oversold Overpay Buyer', buyerEmail: 'oversoldoverpaybuyer@test.invalid', buyerPhone: '+8490xxxxxx4',
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

describe('#515 — oversold + overpaid refunds both the fare and the overpay delta', () => {
  it('captures TWO refunds; operator nets 0; rider refunded the full amount', async () => {
    const res = await processPaymentWebhook({
      rawBody: sepayBody(oversoldRef, String(Date.now())),
      gateway: getBankTransferAdapter(),
      adapter: 'bank_transfer', proto: 'https', host: 'test.invalid',
    });
    expect(res.status).toBe(200);
    // FIX: BOTH the oversold refund AND the overpay refund are captured (was 1 before).
    expect(afterTasks.length).toBe(2);
    await flushAfter();

    const booking = await prisma.booking.findUnique({ where: { id: oversoldBookingId }, select: { status: true } });
    expect(booking?.status).toBe('refunded');

    const rows = await prisma.ledgerEntry.findMany({ where: { bookingId: oversoldBookingId }, select: { type: true, amount: true } });

    // Operator net (excludes refund_out platform float) is 0 — no fee, credit offsets fare clawback.
    const OPERATOR_TYPES = new Set(['booking_credit', 'platform_fee', 'refund_debit', 'chargeback', 'adjustment', 'payout_reversal', 'tax_withheld']);
    const operatorNet = rows.filter((r) => OPERATOR_TYPES.has(r.type)).reduce((s, r) => s + r.amount, BigInt(0));
    expect(operatorNet).toBe(BigInt(0));
    expect(rows.filter((r) => r.type === 'platform_fee').length).toBe(0);
    expect(rows.filter((r) => r.type === 'refund_debit').length).toBe(1); // oversold clawback only

    // The rider is refunded the FULL amount: fare (oversold) + overpay delta, both as refund_out.
    const refundOuts = rows.filter((r) => r.type === 'refund_out');
    expect(refundOuts.length).toBe(2);
    // refund_out is stored as a negative (platform-float outflow); magnitude = full amount paid.
    const totalRefunded = refundOuts.reduce((s, r) => s + r.amount, BigInt(0));
    expect(totalRefunded).toBe(BigInt(-AMOUNT));
  });
});
