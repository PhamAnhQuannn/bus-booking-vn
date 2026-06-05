/**
 * Integration test for Issue 052 — chargeback + payout_reversal against a real DB.
 *
 * Seeds two operators (one pre-payout, one post-payout) each with a paid booking
 * and its booking_credit/platform_fee ledger entries, then exercises
 * recordChargeback and asserts against the DERIVED operator balance (Issue 050):
 *
 *   PRE-PAYOUT  → one chargeback (−total) entry, NO payout_reversal; the operator
 *                 balance drops by `total` relative to pre-chargeback.
 *   POST-PAYOUT → payout_reversal (+total) + chargeback (−2·total); the SIGNED SUM
 *                 of the two is −total (NOT −2·total); balance drops by `total`
 *                 relative to pre-chargeback, AND the case is distinguishable in
 *                 the ledger by the presence of the payout_reversal row.
 *   IDEMPOTENT  → replaying the same sourceEventId writes NO new rows.
 *   BACKSTOP    → when available < clawback, a chargeback_backstop adjustment of
 *                 +shortfall floors the operator at −available; backstopped == it.
 *
 * DB-gated — does not run locally (no DB); runs in CI against a migrated DB.
 * Run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { appendLedgerEntry } from '../ledgerRepo';
import { getOperatorBalance } from '../balance';
import { recordChargeback, listChargebacks } from '../chargeback';

const GROSS = 250_000; // VND
const FEE = 15_000; // platform_fee entry written at paid (6% half-even)
const NET = GROSS - FEE; // operator net = what a payout would disburse

interface Seed {
  operatorId: string;
  routeId: string;
  busId: string;
  tripId: string;
  bookingId: string;
}

/** Sum the operator's full net balance figure (pending + available + paidOut). */
async function netBalance(operatorId: string): Promise<bigint> {
  const b = await getOperatorBalance(operatorId);
  return b.pending + b.available + b.paidOut;
}

/**
 * @param topUp when true, seed an extra +GROSS `adjustment` so the operator's
 *   AVAILABLE balance (= NET from the credit/fee legs) comfortably exceeds a
 *   GROSS clawback — the pre/post-payout cases assert "balance drops by total"
 *   with NO platform backstop, which requires available ≥ clawback. The `short`
 *   operator is seeded WITHOUT the top-up precisely so its clawback DOES exceed
 *   available and exercises the backstop path.
 */
async function seedOperator(tag: string, plateSuffix: string, topUp = false): Promise<Seed> {
  const op = await prisma.operator.create({
    data: {
      legalName: `Ledger052 ${tag}`,
      contactPhone: '+8490xxxxxx6',
      contactEmail: `ledger052-${plateSuffix}@test.invalid`,
    },
  });
  const bus = await prisma.bus.create({
    data: {
      operatorId: op.id,
      capacity: 10,
      licensePlate: `TEST-L52-${plateSuffix}`,
      busType: 'coach',
    },
  });
  const route = await prisma.route.create({
    data: {
      origin: 'L52 Origin',
      destination: 'L52 Destination',
      operatorId: op.id,
      durationMinutes: 240,
    },
  });
  // Completed + T+1-elapsed trip so the credit is settlement-eligible (available).
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
      bookingRef: `BB-2052-${randomUUID().slice(0, 4)}-${plateSuffix}`,
      confirmationToken: randomUUID().replace(/-/g, '') + tag.slice(0, 2),
      tripId: trip.id,
      buyerName: 'Ledger Buyer',
      buyerPhone: '+8490xxxxxx4',
      ticketCount: 1,
      totalVnd: GROSS,
      paymentMethod: 'momo',
      paymentExternalRef: `stub_inbound_txn_052_${plateSuffix}`,
      status: 'completed',
    },
  });

  // The paid transition's ledger legs (slice 049).
  await appendLedgerEntry({
    operatorId: op.id,
    bookingId,
    type: 'booking_credit',
    amountMinor: BigInt(GROSS),
    sourceEventId: `booking_credit:${bookingId}`,
  });
  await appendLedgerEntry({
    operatorId: op.id,
    bookingId,
    type: 'platform_fee',
    amountMinor: BigInt(-FEE),
    sourceEventId: `platform_fee:${bookingId}`,
  });

  if (topUp) {
    // +GROSS settlement-eligible adjustment so available (= NET) → NET + GROSS,
    // comfortably covering a GROSS clawback with no backstop. Tied to the same
    // settled booking so it counts as available, not pending.
    await appendLedgerEntry({
      operatorId: op.id,
      bookingId,
      type: 'adjustment',
      amountMinor: BigInt(GROSS),
      sourceEventId: `topup:${bookingId}`,
    });
  }

  return {
    operatorId: op.id,
    routeId: route.id,
    busId: bus.id,
    tripId: trip.id,
    bookingId,
  };
}

let pre: Seed;
let post: Seed;
let short: Seed;
let postPayoutId: string;

beforeAll(async () => {
  pre = await seedOperator('Pre', 'PRE', true);
  post = await seedOperator('Post', 'PST', true);
  short = await seedOperator('Short', 'SHT'); // no top-up → clawback exceeds available

  // POST operator: simulate a completed payout — a `paid` Payout row + the
  // payout_debit ledger drain (what processPayouts writes on requested→paid).
  const payout = await prisma.payout.create({
    data: {
      tripId: post.tripId,
      operatorId: post.operatorId,
      gross: GROSS,
      platformFee: FEE,
      net: NET,
      status: 'paid',
      scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      settledAt: new Date(),
    },
  });
  postPayoutId = payout.id;
  await appendLedgerEntry({
    operatorId: post.operatorId,
    payoutId: payout.id,
    type: 'payout_debit',
    amountMinor: -BigInt(NET),
    sourceEventId: `payout_debit:${payout.id}`,
  });
});

afterAll(async () => {
  const operatorIds = [pre.operatorId, post.operatorId, short.operatorId];
  const tripIds = [pre.tripId, post.tripId, short.tripId];
  const routeIds = [pre.routeId, post.routeId, short.routeId];
  const bookingIds = [pre.bookingId, post.bookingId, short.bookingId];

  // LedgerEntry is append-only (immutability trigger) — drop to clean up.
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_update" ON "LedgerEntry"');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_delete" ON "LedgerEntry"');
  await prisma.ledgerEntry.deleteMany({ where: { operatorId: { in: operatorIds } } });
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_update" BEFORE UPDATE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_delete" BEFORE DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );

  await prisma.payout.deleteMany({ where: { id: postPayoutId } });
  await prisma.notificationLog.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
  await prisma.route.deleteMany({ where: { id: { in: routeIds } } });
  await prisma.bus.deleteMany({ where: { operatorId: { in: operatorIds } } });
  await prisma.operator.deleteMany({ where: { id: { in: operatorIds } } });
  await prisma.$disconnect();
});

describe('Issue 052 — pre-payout chargeback', () => {
  it('writes one chargeback −total entry, NO payout_reversal; balance drops by total', async () => {
    const before = await netBalance(pre.operatorId); // NET (credit−fee) + GROSS top-up
    expect(before).toBe(BigInt(NET + GROSS));

    const res = await recordChargeback({
      bookingId: pre.bookingId,
      amountMinor: GROSS,
      sourceEventId: 'dispute-pre-1',
    });
    expect(res).toEqual({ recorded: true, alreadyDone: false, backstopped: 0 });

    const cb = await prisma.ledgerEntry.findUnique({
      where: { sourceEventId: 'chargeback:dispute-pre-1' },
    });
    const pr = await prisma.ledgerEntry.findUnique({
      where: { sourceEventId: 'payout_reversal:dispute-pre-1' },
    });
    expect(cb).not.toBeNull();
    expect(cb!.amount).toBe(BigInt(-GROSS));
    expect(cb!.type).toBe('chargeback');
    expect(pr).toBeNull(); // distinguishable: no payout_reversal pre-payout

    const after = await netBalance(pre.operatorId);
    expect(after).toBe(before - BigInt(GROSS)); // delta = −total
  });
});

describe('Issue 052 — post-payout chargeback', () => {
  it('writes payout_reversal +total AND chargeback −2·total; net entries = −total', async () => {
    const before = await netBalance(post.operatorId);

    const res = await recordChargeback({
      bookingId: post.bookingId,
      amountMinor: GROSS,
      sourceEventId: 'dispute-post-1',
    });
    expect(res.recorded).toBe(true);

    const cb = await prisma.ledgerEntry.findUnique({
      where: { sourceEventId: 'chargeback:dispute-post-1' },
    });
    const pr = await prisma.ledgerEntry.findUnique({
      where: { sourceEventId: 'payout_reversal:dispute-post-1' },
    });
    expect(pr).not.toBeNull();
    expect(pr!.amount).toBe(BigInt(GROSS)); // +total
    expect(pr!.type).toBe('payout_reversal');
    expect(cb).not.toBeNull();
    expect(cb!.amount).toBe(BigInt(-2 * GROSS)); // −2·total

    // SIGNED SUM of the two NEW entries is exactly −total (NOT −2·total).
    expect(pr!.amount + cb!.amount).toBe(BigInt(-GROSS));

    // Operator net balance drops by exactly `total` relative to pre-chargeback.
    const after = await netBalance(post.operatorId);
    expect(after).toBe(before - BigInt(GROSS));
  });

  it('replay of the same sourceEventId writes NO new entries (idempotent)', async () => {
    const cbBefore = await prisma.ledgerEntry.count({
      where: { bookingId: post.bookingId, type: 'chargeback' },
    });
    const prBefore = await prisma.ledgerEntry.count({
      where: { bookingId: post.bookingId, type: 'payout_reversal' },
    });

    const res = await recordChargeback({
      bookingId: post.bookingId,
      amountMinor: GROSS,
      sourceEventId: 'dispute-post-1', // same key
    });
    expect(res).toEqual({ recorded: false, alreadyDone: true, backstopped: 0 });

    expect(
      await prisma.ledgerEntry.count({
        where: { bookingId: post.bookingId, type: 'chargeback' },
      })
    ).toBe(cbBefore);
    expect(
      await prisma.ledgerEntry.count({
        where: { bookingId: post.bookingId, type: 'payout_reversal' },
      })
    ).toBe(prBefore);
  });
});

describe('Issue 052 — insufficient-balance backstop (S15#7)', () => {
  it('records a chargeback_backstop adjustment of +shortfall; operator floors at −available', async () => {
    // SHORT operator's available = NET (235k). Clawback a LARGER amount so the
    // operator cannot cover it → platform bad-debt backstop.
    const claw = NET + 100_000; // 335k > available 235k → shortfall 100k
    const before = await getOperatorBalance(short.operatorId);
    expect(before.available).toBe(BigInt(NET));
    const beforeNet = await netBalance(short.operatorId); // == available == NET

    const res = await recordChargeback({
      bookingId: short.bookingId,
      amountMinor: claw,
      sourceEventId: 'dispute-short-1',
    });
    expect(res.recorded).toBe(true);
    expect(res.backstopped).toBe(100_000); // claw − available

    const adj = await prisma.ledgerEntry.findUnique({
      where: { sourceEventId: 'chargeback_backstop:dispute-short-1' },
    });
    expect(adj).not.toBeNull();
    expect(adj!.type).toBe('adjustment');
    expect(adj!.amount).toBe(BigInt(100_000)); // +shortfall

    // The chargeback+backstop net DELTA is exactly −available (chargeback.ts:66-70):
    //   −claw + shortfall = −claw + (claw − available) = −available.
    // The platform ate the 100k it couldn't cover. The operator's B started at its
    // available (NET) and the −available delta lands it at exactly 0 — the operator
    // is floored at owing only what it could cover (NET), not the full clawback.
    const after = await netBalance(short.operatorId);
    expect(after).toBe(beforeNet - BigInt(NET)); // delta = −available = −NET → 0
  });
});

describe('Issue 052 — listChargebacks read', () => {
  it('returns chargeback + payout_reversal + backstop adjustment rows', async () => {
    const all = await listChargebacks();
    const types = new Set(all.map((e) => e.type));
    expect(types.has('chargeback')).toBe(true);
    expect(types.has('payout_reversal')).toBe(true);

    // Backstop adjustments are included (tagged by sourceEventId prefix).
    expect(
      all.some((e) => e.sourceEventId.startsWith('chargeback_backstop:'))
    ).toBe(true);

    // operatorId filter scopes the read.
    const onlyPre = await listChargebacks(pre.operatorId);
    expect(onlyPre.every((e) => e.operatorId === pre.operatorId)).toBe(true);
    expect(onlyPre.some((e) => e.type === 'chargeback')).toBe(true);
  });
});
