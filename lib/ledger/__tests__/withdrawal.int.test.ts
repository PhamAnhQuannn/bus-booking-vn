/**
 * Integration test for Issue 053 — on-demand operator withdrawal.
 *
 * Seeds an operator with an AVAILABLE balance: a COMPLETED trip whose completedAt
 * is past the T+1 settlement window, a paid booking, and the booking_credit +
 * platform_fee ledger entries the paid transition writes (slice 049). The net of
 * those entries on a settled trip is `available`.
 *
 * Asserts:
 *   - withdraw(available) succeeds → a requested, tripId:null Payout exists and
 *     balance.available drops by the withdrawn amount (the payout_debit drains it).
 *   - CONCURRENT double-withdraw of the last available amount with DIFFERENT keys
 *     → exactly ONE succeeds (the FOR UPDATE on Operator serialises; the loser's
 *     under-lock available recompute sees the winner's debit and fails).
 *   - CONCURRENT same-key replay → exactly ONE Payout (the in-lock marker re-probe
 *     dedups), both calls return the SAME payoutId.
 *   - the sweep paying the withdrawal Payout does NOT write a second payout_debit:
 *     exactly ONE payout_debit per payout (the withdrawal's key is sweep-aligned
 *     `payout_debit:<payoutId>`, so processPayouts' append is a P2002 no-op).
 *
 * DB-gated — does not run locally (no DB); runs in CI against a migrated DB.
 * Run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { appendLedgerEntry } from '../ledgerRepo';
import { getOperatorBalance } from '../balance';
import { requestWithdrawal } from '../withdrawal';
import { processPayouts } from '@/lib/jobs/processPayouts';

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;
let bookingId: string;

const GROSS = 500_000; // VND
const FEE = 30_000; // 6% half-even
const AVAILABLE = GROSS - FEE; // 470_000 — the settled net the operator may withdraw

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: {
      legalName: 'Ledger053 Test Op',
      contactPhone: '+8490xxxxxx3',
      contactEmail: 'ledger053@test.invalid',
    },
  });
  operatorId = op.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 20, licensePlate: 'TEST-L53-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: { origin: 'L53 Origin', destination: 'L53 Destination', operatorId, durationMinutes: 300 },
  });
  routeId = route.id;

  // COMPLETED trip, departed/completed well in the past so completedAt + T+1 < NOW
  // → the booking_credit/platform_fee entries are settlement-eligible (available).
  const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: past,
      price: GROSS,
      status: 'completed',
      salesClosed: true,
      completedAt: past,
    },
  });
  tripId = trip.id;

  bookingId = randomUUID();
  await prisma.booking.create({
    data: {
      id: bookingId,
      bookingRef: `BB-2053-${randomUUID().slice(0, 4)}-l053`,
      confirmationToken: randomUUID().replace(/-/g, '') + 'l5',
      tripId,
      buyerName: 'Withdrawal Buyer',
      buyerPhone: '+8490xxxxxx2',
      ticketCount: 2,
      totalVnd: GROSS,
      paymentMethod: 'momo',
      paymentExternalRef: 'stub_inbound_txn_053',
      status: 'completed',
    },
  });

  // Seed the paid-transition ledger entries (slice 049): net = available.
  await appendLedgerEntry({
    operatorId,
    bookingId,
    type: 'booking_credit',
    amountMinor: BigInt(GROSS),
    sourceEventId: `booking_credit:${bookingId}`,
  });
  await appendLedgerEntry({
    operatorId,
    bookingId,
    type: 'platform_fee',
    amountMinor: BigInt(-FEE),
    sourceEventId: `platform_fee:${bookingId}`,
  });
});

afterAll(async () => {
  // LedgerEntry is append-only (immutability trigger) — drop triggers to clean up.
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_update" ON "LedgerEntry"');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_delete" ON "LedgerEntry"');
  await prisma.ledgerEntry.deleteMany({ where: { operatorId } });
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_update" BEFORE UPDATE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_delete" BEFORE DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );

  await prisma.payout.deleteMany({ where: { operatorId } });
  await prisma.booking.deleteMany({ where: { id: bookingId } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('Issue 053 — on-demand withdrawal', () => {
  it('withdraw(available) succeeds, creates a requested tripId:null Payout, drops available', async () => {
    const before = await getOperatorBalance(operatorId);
    expect(before.available).toBe(BigInt(AVAILABLE));

    const partial = 100_000;
    const res = await requestWithdrawal({
      operatorId,
      amountMinor: partial,
      idempotencyKey: `wd-partial-${randomUUID()}`,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const payout = await prisma.payout.findUniqueOrThrow({ where: { id: res.payoutId } });
    expect(payout.tripId).toBeNull();
    expect(payout.status).toBe('requested');
    expect(payout.platformFee).toBe(0);
    expect(payout.net).toBe(partial);

    // available dropped by the withdrawn amount (the payout_debit drained it).
    const after = await getOperatorBalance(operatorId);
    expect(after.available).toBe(BigInt(AVAILABLE - partial));

    // exactly one payout_debit for this payout.
    const debits = await prisma.ledgerEntry.count({
      where: { payoutId: res.payoutId, type: 'payout_debit' },
    });
    expect(debits).toBe(1);
  });

  it('rejects below_min and insufficient', async () => {
    const below = await requestWithdrawal({
      operatorId,
      amountMinor: 1_000,
      idempotencyKey: `wd-below-${randomUUID()}`,
    });
    expect(below).toEqual({ ok: false, reason: 'below_min' });

    const tooBig = await requestWithdrawal({
      operatorId,
      amountMinor: 10_000_000,
      idempotencyKey: `wd-big-${randomUUID()}`,
    });
    expect(tooBig).toEqual({ ok: false, reason: 'insufficient_available' });
  });

  it('CONCURRENT different-key withdraws of the remaining available → exactly ONE succeeds', async () => {
    const remaining = await getOperatorBalance(operatorId);
    const amount = Number(remaining.available); // try to withdraw ALL of it, twice

    const [a, b] = await Promise.all([
      requestWithdrawal({ operatorId, amountMinor: amount, idempotencyKey: `wd-raceA-${randomUUID()}` }),
      requestWithdrawal({ operatorId, amountMinor: amount, idempotencyKey: `wd-raceB-${randomUUID()}` }),
    ]);

    const successes = [a, b].filter((r) => r.ok).length;
    expect(successes).toBe(1); // FOR UPDATE serialises; loser sees the drained balance.

    const loser = [a, b].find((r) => !r.ok);
    expect(loser).toEqual({ ok: false, reason: 'insufficient_available' });

    // available is now fully drained.
    const after = await getOperatorBalance(operatorId);
    expect(after.available).toBe(BigInt(0));
  });

  it('CONCURRENT same-key replay → exactly ONE Payout, same payoutId', async () => {
    // Re-seed a fresh available bucket via an adjustment so there is something to pull.
    await appendLedgerEntry({
      operatorId,
      bookingId,
      type: 'adjustment',
      amountMinor: BigInt(150_000),
      sourceEventId: `topup:${randomUUID()}`,
    });
    // adjustment on a settled-trip booking is settlement-eligible → available.
    const key = `wd-samekey-${randomUUID()}`;
    const [a, b] = await Promise.all([
      requestWithdrawal({ operatorId, amountMinor: 150_000, idempotencyKey: key }),
      requestWithdrawal({ operatorId, amountMinor: 150_000, idempotencyKey: key }),
    ]);

    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.payoutId).toBe(b.payoutId); // dedup: one Payout for one key
    }
    const payoutCount = await prisma.payout.count({
      where: { operatorId, tripId: null, net: 150_000 },
    });
    expect(payoutCount).toBe(1);
  });

  it('the sweep paying a withdrawal Payout does NOT double-debit', async () => {
    // Create a fresh available bucket and a withdrawal whose Payout the sweep pays.
    await appendLedgerEntry({
      operatorId,
      bookingId,
      type: 'adjustment',
      amountMinor: BigInt(120_000),
      sourceEventId: `topup2:${randomUUID()}`,
    });
    const res = await requestWithdrawal({
      operatorId,
      amountMinor: 120_000,
      idempotencyKey: `wd-sweep-${randomUUID()}`,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const before = await prisma.ledgerEntry.count({
      where: { payoutId: res.payoutId, type: 'payout_debit' },
    });
    expect(before).toBe(1); // written at request time, sweep-aligned key

    // Run the sweep — it transitions requested → paid and tries to append
    // `payout_debit:<payoutId>`, which ALREADY exists → P2002 no-op.
    await prisma.$transaction((tx) => processPayouts(tx));

    const paid = await prisma.payout.findUniqueOrThrow({ where: { id: res.payoutId } });
    expect(paid.status).toBe('paid');

    const after = await prisma.ledgerEntry.count({
      where: { payoutId: res.payoutId, type: 'payout_debit' },
    });
    expect(after).toBe(1); // STILL exactly one — no double debit.
  });
});
