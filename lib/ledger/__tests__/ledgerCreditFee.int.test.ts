/**
 * Integration test for Issue 049 — booking_credit + platform_fee ledger entries
 * wired at the booking-paid transition in processPaymentWebhook.
 *
 * Seeds operator + route + bus + trip + an awaiting_payment booking + a global
 * FeeConfig row (6% = 60000 ppm), then drives a signed paid stub IPN through the
 * SAME processPaymentWebhook path the real gateways use. Asserts:
 *   - exactly one booking_credit (+gross) referencing the booking
 *   - exactly one platform_fee (−fee) referencing the booking
 *   - balance SUM = gross − fee = net
 *   - replaying the same paid IPN leaves exactly 2 entries (idempotent: the
 *     monotonic transition guard skips the ledger block on updated=0).
 *
 * DB-gated — does not run locally (no DB); runs in CI against a migrated DB.
 *
 * Run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { getEnv } from '@/lib/config';
import { processPaymentWebhook } from '@/lib/payment';
import { createStubAdapter, buildStubIpn } from '@/lib/payment';
import { deriveOperatorBalance } from '../ledgerRepo';

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;
let bookingId: string;
let bookingRef: string;
let feeConfigId: string | null = null;

const GROSS = 250_000; // VND — 6% half-even = 15_000
const EXPECTED_FEE = BigInt(15_000);

const stubSecret = getEnv().STUB_PAYMENT_SECRET;
const gateway = createStubAdapter({ secretKey: stubSecret, baseUrl: 'https://test.invalid', adapter: 'momo' });

/** Build the raw signed paid stub IPN body for our booking. */
function paidIpnBody(): string {
  const ipn = buildStubIpn({
    secretKey: stubSecret,
    adapter: 'momo',
    orderId: bookingRef,
    amount: GROSS,
    outcome: 'success',
  });
  return JSON.stringify(ipn);
}

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: { legalName: 'Ledger049 Test Op', contactPhone: '+8490xxxxxx7', contactEmail: 'ledger049@test.invalid' },
  });
  operatorId = op.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 10, licensePlate: 'TEST-L49-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: { origin: 'L49 Origin', destination: 'L49 Destination', operatorId, durationMinutes: 240 },
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
  bookingRef = `BB-2049-${randomUUID().slice(0, 4)}-l049`;
  await prisma.booking.create({
    data: {
      id: bookingId,
      bookingRef,
      confirmationToken: randomUUID().replace(/-/g, '') + 'l4',
      tripId,
      buyerName: 'Ledger Buyer',
      buyerPhone: '+8490xxxxxx5',
      ticketCount: 1,
      totalVnd: GROSS,
      paymentMethod: 'momo',
      status: 'awaiting_payment',
    },
  });

  // Ensure a covering global FeeConfig row exists (the cutover seed normally
  // provides this; create one only if absent so the test is self-contained).
  const existing = await prisma.feeConfig.findFirst({
    where: { operatorId: null, effectiveTo: null },
  });
  if (!existing) {
    const fc = await prisma.feeConfig.create({
      data: { operatorId: null, ratePpm: 60000, effectiveFrom: new Date('2020-01-01T00:00:00Z') },
    });
    feeConfigId = fc.id;
  }
});

afterAll(async () => {
  // LedgerEntry is append-only (immutability trigger) — drop the triggers to clean up.
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_update" ON "LedgerEntry"');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_delete" ON "LedgerEntry"');
  await prisma.ledgerEntry.deleteMany({ where: { operatorId } });
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_update" BEFORE UPDATE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_delete" BEFORE DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );

  await prisma.paymentEvent.deleteMany({ where: { bookingId } });
  await prisma.notificationLog.deleteMany({ where: { bookingId } });
  await prisma.booking.deleteMany({ where: { id: bookingId } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  if (feeConfigId) await prisma.feeConfig.delete({ where: { id: feeConfigId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('Issue 049 — ledger entries at booking-paid', () => {
  it('appends exactly one booking_credit (+gross) and one platform_fee (−fee) on first paid IPN', async () => {
    const res = await processPaymentWebhook({
      rawBody: paidIpnBody(),
      gateway,
      adapter: 'momo',
      proto: 'https',
      host: 'test.invalid',
    });
    expect(res.status).toBe(200);

    const entries = await prisma.ledgerEntry.findMany({
      where: { bookingId },
      orderBy: { type: 'asc' },
    });
    expect(entries.length).toBe(2);

    const credit = entries.find((e) => e.type === 'booking_credit');
    const fee = entries.find((e) => e.type === 'platform_fee');
    expect(credit).toBeDefined();
    expect(fee).toBeDefined();

    expect(credit!.amount).toBe(BigInt(GROSS)); // +gross
    expect(credit!.operatorId).toBe(operatorId);
    expect(credit!.sourceEventId).toBe(`booking_credit:${bookingId}`);

    expect(fee!.amount).toBe(-EXPECTED_FEE); // −fee
    expect(fee!.operatorId).toBe(operatorId);
    expect(fee!.sourceEventId).toBe(`platform_fee:${bookingId}`);

    // Balance = SUM = gross − fee = net.
    const balance = await deriveOperatorBalance(operatorId);
    expect(balance).toBe(BigInt(GROSS) - EXPECTED_FEE);
  });

  it('replaying the same paid IPN leaves exactly 2 entries (idempotent)', async () => {
    // Same providerTxnId (stub transId is deterministic) → PaymentEvent P2002 →
    // 200 no-op; even if it weren't, the booking already left awaiting_payment so
    // the monotonic guard yields updated=0 and the ledger block is skipped.
    const res = await processPaymentWebhook({
      rawBody: paidIpnBody(),
      gateway,
      adapter: 'momo',
      proto: 'https',
      host: 'test.invalid',
    });
    expect(res.status).toBe(200);

    const entries = await prisma.ledgerEntry.findMany({ where: { bookingId } });
    expect(entries.length).toBe(2); // still exactly 2 — no duplicates
  });
});
