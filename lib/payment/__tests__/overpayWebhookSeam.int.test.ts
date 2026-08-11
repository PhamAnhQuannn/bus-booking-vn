/**
 * Integration test — P0-3 end-to-end seam: a bank-transfer OVERPAYMENT drives the
 * real webhook, and the post-commit overpay refund must NOT debit the operator.
 *
 * Drives the real `processPaymentWebhook` with a SePay body whose transferAmount >
 * booking.totalVnd. The overpay branch schedules the refund via next/server `after`;
 * a vitest call has no request scope, so `after` is mocked to CAPTURE the task, which
 * the test then flushes (runs refundOut('overpay_difference')). Asserts the operator
 * is credited the fare only and is NOT clawed back for the overpay (P0-3).
 *
 * DB-gated — run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'crypto';

// Capture next/server `after` tasks (no request scope in vitest) but keep the real
// NextResponse that processPaymentWebhook returns.
const { afterTasks } = vi.hoisted(() => ({ afterTasks: [] as Array<() => Promise<unknown>> }));
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: (task: () => Promise<unknown>) => { afterTasks.push(task); } };
});
const flushAfter = async () => {
  for (const t of afterTasks.splice(0)) await t();
};

import { prisma } from '@/lib/core/db/client';
import { processPaymentWebhook, getBankTransferAdapter } from '@/lib/payment';
import { getOperatorBalance } from '@/lib/ledger';
import { generateBookingRef } from '@/lib/core/id';

const GROSS = 500_000;
const FEE = 30_000; // 6%
const NET = GROSS - FEE; // 470_000
const OVERPAY = 50_000;

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;
let bookingId: string;
let bookingRef: string;
let exactBookingId: string;
let exactBookingRef: string;
let feeConfigId: string | null = null;

function sepayBody(ref: string, txnId: string, amount: number): string {
  const memo = ref.replace(/-/g, '');
  return JSON.stringify({
    id: Number(txnId),
    gateway: 'Sacombank',
    transactionDate: '2026-08-11 14:01:13',
    accountNumber: '030976167267',
    subAccount: null,
    transferType: 'in',
    transferAmount: amount,
    accumulated: 0,
    code: null,
    content: `${memo} CKN 123456`,
    referenceCode: 'VN00OVP26204HJH15',
    description: `BankAPINotify ${memo}`,
  });
}

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: { legalName: 'Overpay Seam Op', contactPhone: '+8490xxxxxx6', contactEmail: 'ovpseam@test.invalid', status: 'APPROVED' },
  });
  operatorId = op.id;
  const bus = await prisma.bus.create({ data: { operatorId, capacity: 20, licensePlate: 'TEST-OVS-001', busType: 'coach' } });
  busId = bus.id;
  const route = await prisma.route.create({ data: { origin: 'OVS Origin', destination: 'OVS Destination', operatorId, durationMinutes: 120 } });
  routeId = route.id;
  // Completed + past T+1 so the fare credit is settlement-eligible (available).
  const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const trip = await prisma.trip.create({
    data: { routeId, busId, operatorId, departureAt: past, price: GROSS, status: 'completed', salesClosed: true, completedAt: past },
  });
  tripId = trip.id;

  bookingId = randomUUID();
  bookingRef = generateBookingRef();
  await prisma.booking.create({
    data: {
      id: bookingId, bookingRef, confirmationToken: randomUUID().replace(/-/g, '') + 'os',
      tripId, buyerName: 'Overpay Buyer', buyerEmail: 'ovpbuyer@test.invalid', buyerPhone: '+8490xxxxxx5',
      ticketCount: 1, totalVnd: GROSS, paymentMethod: 'bank_transfer', status: 'awaiting_payment',
    },
  });

  exactBookingId = randomUUID();
  exactBookingRef = generateBookingRef();
  await prisma.booking.create({
    data: {
      id: exactBookingId, bookingRef: exactBookingRef, confirmationToken: randomUUID().replace(/-/g, '') + 'ox',
      tripId, buyerName: 'Exact Buyer', buyerEmail: 'exactbuyer@test.invalid', buyerPhone: '+8490xxxxxx4',
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
  const ids = [bookingId, exactBookingId];
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

describe('P0-3 seam — overpay via the real webhook does not debit the operator', () => {
  it('overpayment → paid + refund_out only; operator keeps the full fare', async () => {
    const res = await processPaymentWebhook({
      rawBody: sepayBody(bookingRef, String(Date.now()), GROSS + OVERPAY),
      gateway: getBankTransferAdapter(),
      adapter: 'bank_transfer', proto: 'https', host: 'test.invalid',
    });
    expect(res.status).toBe(200);
    expect(afterTasks.length).toBe(1); // overpay refund captured, not yet run
    await flushAfter();

    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
    expect(booking?.status).toBe('paid');

    const credit = await prisma.ledgerEntry.findFirst({ where: { bookingId, type: 'booking_credit' } });
    expect(credit?.amount).toBe(BigInt(GROSS)); // fare only, NOT GROSS+OVERPAY

    const refundOutRows = await prisma.ledgerEntry.findMany({ where: { bookingId, type: 'refund_out' } });
    expect(refundOutRows.length).toBe(1);
    expect(refundOutRows[0].amount).toBe(BigInt(-OVERPAY));

    // P0-3: NO operator clawback for money the operator was never credited.
    const refundDebit = await prisma.ledgerEntry.count({ where: { bookingId, type: 'refund_debit' } });
    expect(refundDebit).toBe(0);

    // Operator balance = fare − fee; the overpay refund never touched it.
    const bal = await getOperatorBalance(operatorId);
    expect(bal.available).toBe(BigInt(NET));
    expect(bal.pending + bal.available + bal.paidOut).toBe(BigInt(NET));
  });

  it('control: an EXACT payment triggers no refund at all', async () => {
    const res = await processPaymentWebhook({
      rawBody: sepayBody(exactBookingRef, String(Date.now() + 1), GROSS),
      gateway: getBankTransferAdapter(),
      adapter: 'bank_transfer', proto: 'https', host: 'test.invalid',
    });
    expect(res.status).toBe(200);
    expect(afterTasks.length).toBe(0); // no overpay, no oversold → no scheduled refund

    const refundOutRows = await prisma.ledgerEntry.count({ where: { bookingId: exactBookingId, type: 'refund_out' } });
    const refundDebit = await prisma.ledgerEntry.count({ where: { bookingId: exactBookingId, type: 'refund_debit' } });
    expect(refundOutRows).toBe(0);
    expect(refundDebit).toBe(0);
  });
});
