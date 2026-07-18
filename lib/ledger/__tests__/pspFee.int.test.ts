/**
 * Integration test for Issue 123 — VNPay psp_fee (MDR) platform-float ledger entry.
 *
 * Asserts, against a real migrated DB:
 *   - appendBookingPaidLedger(adapter='vnpay') writes a psp_fee entry of
 *     −floor(gross · VNPAY_MDR_PPM / 1e6), in addition to booking_credit + platform_fee.
 *   - psp_fee is PLATFORM-FLOAT: it is EXCLUDED from getOperatorBalance — the
 *     operator's available balance is gross − platform_fee, NOT minus psp_fee.
 *   - a NON-vnpay adapter (bank_transfer) writes NO psp_fee entry.
 *   - psp_fee is idempotent on its sourceEventId (a duplicate append is a no-op).
 *   - sumPspFees reports the positive-magnitude total.
 *
 * DB-gated — run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { appendBookingPaidLedger } from '@/lib/payment';
import { appendLedgerEntry } from '../ledgerRepo';
import { getOperatorBalance } from '../balance';
import { sumPspFees } from '../pspFees';
import { VNPAY_MDR_PPM } from '../constants';

const GROSS = 250_000; // VND
const FEE_PPM = 60_000; // 6% per-operator override seeded below
const PLATFORM_FEE = 15_000; // 6% half-even of 250,000
const NET = GROSS - PLATFORM_FEE; // 235,000 — operator available (psp_fee EXCLUDED)
// applyFeePpm floors: 250,000 · 11000 / 1,000,000 = 2,750
const EXPECTED_PSP_FEE = Math.floor((GROSS * VNPAY_MDR_PPM) / 1_000_000);

interface Seed {
  operatorId: string;
  bookingId: string;
}

async function seed(tag: string, suffix: string): Promise<Seed> {
  const op = await prisma.operator.create({
    data: {
      legalName: `PspFee ${tag}`,
      contactPhone: '+8490xxxxxx6',
      contactEmail: `pspfee-${suffix}@test.invalid`,
    },
  });
  // Per-operator fee override so getEffectiveFeeRate is deterministic + isolated.
  await prisma.feeConfig.create({
    data: {
      operatorId: op.id,
      ratePpm: FEE_PPM,
      effectiveFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  });
  const bus = await prisma.bus.create({
    data: { operatorId: op.id, capacity: 10, licensePlate: `TEST-PSP-${suffix}`, busType: 'coach' },
  });
  const route = await prisma.route.create({
    data: { origin: 'PSP Origin', destination: 'PSP Destination', operatorId: op.id, durationMinutes: 240 },
  });
  // Completed + T+1-elapsed trip so the credit is settlement-eligible (available bucket).
  const trip = await prisma.trip.create({
    data: {
      routeId: route.id,
      busId: bus.id,
      operatorId: op.id,
      departureAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      price: GROSS,
      status: 'completed',
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      salesClosed: true,
    },
  });
  const bookingId = randomUUID();
  await prisma.booking.create({
    data: {
      id: bookingId,
      bookingRef: `BB-2123-${randomUUID().slice(0, 4)}-${suffix}`,
      confirmationToken: randomUUID().replace(/-/g, '') + tag.slice(0, 2),
      tripId: trip.id,
      buyerName: 'Psp Buyer',
      buyerPhone: '+8490xxxxxx4',
      ticketCount: 1,
      totalVnd: GROSS,
      paymentMethod: 'vnpay',
      status: 'completed',
    },
  });
  return { operatorId: op.id, bookingId };
}

let vnpaySeed: Seed;
let bankSeed: Seed;

beforeAll(async () => {
  vnpaySeed = await seed('Vnpay', 'VNP');
  bankSeed = await seed('Bank', 'BNK');

  await prisma.$transaction(async (tx) => {
    await appendBookingPaidLedger(tx, {
      operatorId: vnpaySeed.operatorId,
      bookingId: vnpaySeed.bookingId,
      grossVnd: GROSS,
      now: new Date(),
      adapter: 'vnpay',
    });
  });
  await prisma.$transaction(async (tx) => {
    await appendBookingPaidLedger(tx, {
      operatorId: bankSeed.operatorId,
      bookingId: bankSeed.bookingId,
      grossVnd: GROSS,
      now: new Date(),
      adapter: 'bank_transfer',
    });
  });
});

describe('psp_fee — VNPay platform-float MDR entry (Issue 123)', () => {
  it('writes a psp_fee entry of −floor(gross·MDR) for a vnpay booking', async () => {
    const row = await prisma.ledgerEntry.findUnique({
      where: { sourceEventId: `psp_fee:${vnpaySeed.bookingId}` },
      select: { type: true, amount: true, bookingId: true },
    });
    expect(row).not.toBeNull();
    expect(row?.type).toBe('psp_fee');
    expect(row?.amount).toBe(BigInt(-EXPECTED_PSP_FEE)); // −2750
    expect(row?.bookingId).toBe(vnpaySeed.bookingId);
  });

  it('EXCLUDES psp_fee from the operator balance (operator kept whole)', async () => {
    const bal = await getOperatorBalance(vnpaySeed.operatorId);
    // available = gross − platform_fee = 235,000. If psp_fee (−2750) were counted
    // it would be 232,250 — this assertion is the platform-float invariant.
    expect(bal.available).toBe(BigInt(NET));
  });

  it('writes NO psp_fee entry for a non-vnpay (bank_transfer) booking', async () => {
    const row = await prisma.ledgerEntry.findUnique({
      where: { sourceEventId: `psp_fee:${bankSeed.bookingId}` },
      select: { id: true },
    });
    expect(row).toBeNull();
    // Same operator balance math — no psp_fee to exclude in the first place.
    const bal = await getOperatorBalance(bankSeed.operatorId);
    expect(bal.available).toBe(BigInt(NET));
  });

  it('is idempotent on the psp_fee sourceEventId (duplicate append is a no-op)', async () => {
    const before = await prisma.ledgerEntry.count({
      where: { sourceEventId: `psp_fee:${vnpaySeed.bookingId}` },
    });
    const res = await appendLedgerEntry({
      operatorId: vnpaySeed.operatorId,
      bookingId: vnpaySeed.bookingId,
      type: 'psp_fee',
      amountMinor: BigInt(-EXPECTED_PSP_FEE),
      sourceEventId: `psp_fee:${vnpaySeed.bookingId}`,
    });
    expect(res.created).toBe(false); // already existed
    const after = await prisma.ledgerEntry.count({
      where: { sourceEventId: `psp_fee:${vnpaySeed.bookingId}` },
    });
    expect(before).toBe(1);
    expect(after).toBe(1);
  });

  it('sumPspFees reports the positive-magnitude total', async () => {
    const total = await sumPspFees();
    // At least the one vnpay booking's fee (other tests/rows may add more).
    expect(total).toBeGreaterThanOrEqual(BigInt(EXPECTED_PSP_FEE));
  });
});
