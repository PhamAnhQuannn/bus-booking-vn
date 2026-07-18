/**
 * Integration test for Issue 124 — VNPay chargeback PLATFORM-ABSORB path.
 *
 * SPEC DIVERGENCE from S15#7 (operator-liable default): with liability='platform'
 * the platform eats the full disputed amount and the operator is HELD HARMLESS —
 * their derived balance is UNCHANGED. Asserts against a real migrated DB:
 *   - operator balance identical before/after the platform-absorb chargeback,
 *   - a chargeback (−amount) AND a chargeback_platform_absorb adjustment (+amount)
 *     are written (net 0 on the operator),
 *   - result.platformAbsorbed == amount, backstopped == 0,
 *   - idempotent replay (no new rows, balance still unchanged),
 *   - listChargebacks surfaces both legs,
 *   - CONTRAST: the default operator-liable path still drops the balance by amount.
 *
 * DB-gated — run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { appendLedgerEntry } from '../ledgerRepo';
import { getOperatorBalance } from '../balance';
import { recordChargeback, listChargebacks } from '../chargeback';

const GROSS = 250_000;
const FEE = 15_000;
const NET = GROSS - FEE; // 235,000 operator net after paid legs

async function netBalance(operatorId: string): Promise<bigint> {
  const b = await getOperatorBalance(operatorId);
  return b.pending + b.available + b.paidOut;
}

async function seed(tag: string, suffix: string): Promise<{ operatorId: string; bookingId: string }> {
  const op = await prisma.operator.create({
    data: { legalName: `CB124 ${tag}`, contactPhone: '+8490xxxxxx6', contactEmail: `cb124-${suffix}@test.invalid` },
  });
  const bus = await prisma.bus.create({
    data: { operatorId: op.id, capacity: 10, licensePlate: `TEST-CB124-${suffix}`, busType: 'coach' },
  });
  const route = await prisma.route.create({
    data: { origin: 'CB Origin', destination: 'CB Destination', operatorId: op.id, durationMinutes: 240 },
  });
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
      bookingRef: `BB-2124-${randomUUID().slice(0, 4)}-${suffix}`,
      confirmationToken: randomUUID().replace(/-/g, '') + tag.slice(0, 2),
      tripId: trip.id,
      buyerName: 'CB Buyer',
      buyerPhone: '+8490xxxxxx4',
      ticketCount: 1,
      totalVnd: GROSS,
      paymentMethod: 'vnpay',
      status: 'completed',
    },
  });
  // Paid legs (slice 049): booking_credit + platform_fee.
  await appendLedgerEntry({ operatorId: op.id, bookingId, type: 'booking_credit', amountMinor: BigInt(GROSS), sourceEventId: `booking_credit:${bookingId}` });
  await appendLedgerEntry({ operatorId: op.id, bookingId, type: 'platform_fee', amountMinor: BigInt(-FEE), sourceEventId: `platform_fee:${bookingId}` });
  return { operatorId: op.id, bookingId };
}

let platformSeed: { operatorId: string; bookingId: string };
let operatorSeed: { operatorId: string; bookingId: string };
const PLATFORM_KEY = `vnpay-dispute-${randomUUID()}`;

let balanceBeforePlatform: bigint;

beforeAll(async () => {
  platformSeed = await seed('Platform', 'PLT');
  operatorSeed = await seed('Operator', 'OPR');
  balanceBeforePlatform = await netBalance(platformSeed.operatorId);
});

describe('chargeback platform-absorb (Issue 124)', () => {
  it('leaves the operator balance UNCHANGED (operator held harmless)', async () => {
    const res = await recordChargeback({
      bookingId: platformSeed.bookingId,
      amountMinor: GROSS,
      sourceEventId: PLATFORM_KEY,
      liability: 'platform',
    });
    expect(res.recorded).toBe(true);
    expect(res.platformAbsorbed).toBe(GROSS);
    expect(res.backstopped).toBe(0);

    const after = await netBalance(platformSeed.operatorId);
    expect(after).toBe(balanceBeforePlatform); // NET, unchanged
    expect(after).toBe(BigInt(NET));
  });

  it('writes a chargeback (−amount) + a chargeback_platform_absorb (+amount) leg', async () => {
    const cb = await prisma.ledgerEntry.findUnique({
      where: { sourceEventId: `chargeback:${PLATFORM_KEY}` },
      select: { type: true, amount: true },
    });
    const absorb = await prisma.ledgerEntry.findUnique({
      where: { sourceEventId: `chargeback_platform_absorb:${PLATFORM_KEY}` },
      select: { type: true, amount: true },
    });
    expect(cb?.type).toBe('chargeback');
    expect(cb?.amount).toBe(BigInt(-GROSS));
    expect(absorb?.type).toBe('adjustment');
    expect(absorb?.amount).toBe(BigInt(GROSS));
    // No payout_reversal / backstop legs on the platform-absorb path.
    const reversal = await prisma.ledgerEntry.findUnique({ where: { sourceEventId: `payout_reversal:${PLATFORM_KEY}` }, select: { id: true } });
    expect(reversal).toBeNull();
  });

  it('is idempotent — replay writes no new rows, balance stays unchanged', async () => {
    const res = await recordChargeback({
      bookingId: platformSeed.bookingId,
      amountMinor: GROSS,
      sourceEventId: PLATFORM_KEY,
      liability: 'platform',
    });
    expect(res.alreadyDone).toBe(true);
    expect(res.recorded).toBe(false);
    const after = await netBalance(platformSeed.operatorId);
    expect(after).toBe(BigInt(NET));
  });

  it('surfaces both legs via listChargebacks', async () => {
    const rows = await listChargebacks(platformSeed.operatorId);
    const ids = rows.map((r) => r.sourceEventId);
    expect(ids).toContain(`chargeback:${PLATFORM_KEY}`);
    expect(ids).toContain(`chargeback_platform_absorb:${PLATFORM_KEY}`);
  });

  it('CONTRAST: the default operator-liable path still drops the balance by amount', async () => {
    // Use an amount BELOW the operator's available (NET=235k) so no backstop fires
    // and the clawback lands in full on the operator — the platform-absorb contrast.
    const CLAWBACK = 100_000;
    const before = await netBalance(operatorSeed.operatorId);
    const res = await recordChargeback({
      bookingId: operatorSeed.bookingId,
      amountMinor: CLAWBACK,
      sourceEventId: `operator-liable-${randomUUID()}`,
      // no liability → default 'operator'
    });
    expect(res.platformAbsorbed).toBe(0);
    expect(res.backstopped).toBe(0);
    const after = await netBalance(operatorSeed.operatorId);
    expect(after).toBe(before - BigInt(CLAWBACK)); // operator bears the full clawback
  });
});
