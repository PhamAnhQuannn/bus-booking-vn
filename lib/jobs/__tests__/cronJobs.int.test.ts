/**
 * Integration tests for the Issue 019 background cron-job cores (lib/jobs/*).
 *
 * Run with: pnpm vitest:int
 *
 * Each AC maps to one block:
 * - AC1 expireHolds        — active hold past expiresAt flips to 'expired'
 * - AC2 autoCloseSales     — scheduled trip past departure gets salesClosed=true
 * - AC3 autoCompleteTrips  — departed trip past duration → completed + Payout row
 * - AC4 sendReminders      — 24h reminder fires once (reminderSentAt guard)
 * - AC5 processPayouts     — requested→paid (ok) and requested→failed (forced fail);
 *                            Issue 050: paid transition writes ONE payout_debit
 *                            ledger entry, idempotent across re-runs.
 * - AC6 withAdvisoryLock   — second invocation skipped_locked while lock held
 * - I43 generateTrips      — runJob('trip-generate') skips while locked; one
 *                            JobRunLog per run; per-row generation idempotent
 *
 * Cores select GLOBALLY (no operator filter), so assertions check the specific
 * seeded row rather than the core's aggregate rowsAffected count.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { _resetEnvCache } from '@/lib/config/env';
import { expireHolds } from '../expireHolds';
import { autoCloseSales } from '../autoCloseSales';
import { autoCompleteTrips } from '../autoCompleteTrips';
import { sendReminders } from '../sendReminders';
import { processPayouts } from '../processPayouts';
import { generateTrips } from '../generateTrips';
import { runJob } from '../runJob';
import { withAdvisoryLock } from '../withAdvisoryLock';
import type { JobCore } from '../types';

// ────────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────────

let operatorId: string;
let routeId: string;
let busId: string;

async function createTrip(
  departureAt: Date,
  status: string,
  salesClosed: boolean,
  extra: { departedAt?: Date } = {}
): Promise<string> {
  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt,
      price: 100_000,
      status: status as 'scheduled' | 'departed' | 'completed' | 'cancelled',
      salesClosed,
      departedAt: extra.departedAt ?? null,
    },
  });
  return trip.id;
}

async function createBooking(
  tripId: string,
  ref: string,
  status: string,
  totalVnd = 150_000
): Promise<string> {
  const id = randomUUID();
  const b = await prisma.booking.create({
    data: {
      id,
      // Unique-per-run: fixed literals collide on the bookingRef/confirmationToken
      // unique indices with rows leaked by a prior crashed run (afterAll skipped),
      // flaking this file with a P2002. `ref` is a readable hint; the UUID suffix
      // guarantees uniqueness.
      bookingRef: `${ref}-${id.slice(0, 8)}`,
      confirmationToken: 'tok-' + id,
      tripId,
      buyerName: 'Cron Tester',
      buyerPhone: '+8490xxxxxx1',
      ticketCount: 1,
      totalVnd,
      paymentMethod: 'momo',
      status: status as 'paid' | 'completed' | 'cancelled',
      isManual: false,
      contactStatus: 'pending',
    },
  });
  return b.id;
}

beforeAll(async () => {
  // Isolation: the AC5 processPayouts tests below settle EVERY due 'requested'
  // Payout globally inside one $transaction. A stray 'requested' payout from a
  // prior crashed run can abort that tx and roll back this file's own payout
  // transition. No requested payout legitimately pre-exists here (files run
  // sequentially, maxWorkers:1, and we haven't created our operator yet), so any
  // present row is debris — drop its payout_debit ledger entries (append-only
  // trigger) then the payout.
  const strays = await prisma.payout.findMany({ where: { status: 'requested' }, select: { id: true } });
  const strayIds = strays.map((p) => p.id);
  if (strayIds.length) {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_update" ON "LedgerEntry"');
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_delete" ON "LedgerEntry"');
    await prisma.ledgerEntry.deleteMany({ where: { payoutId: { in: strayIds } } });
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER "ledger_entry_no_update" BEFORE UPDATE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
    );
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER "ledger_entry_no_delete" BEFORE DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
    );
    await prisma.payout.deleteMany({ where: { id: { in: strayIds } } });
  }

  const op = await prisma.operator.create({
    data: {
      legalName: 'Cron Test Op',
      contactPhone: '+8490xxxxxx2',
      contactEmail: 'cron@test.dev',
    },
  });
  operatorId = op.id;

  // Issue 078: the sweep only settles payouts for a VERIFIED payout account.
  // Seed one for the test operator so the AC5 happy-path/forced-fail/debit tests
  // (which create payouts under this operatorId) are actually processed.
  await prisma.payoutAccount.create({
    data: {
      operatorId,
      bankName: 'Cron Test Bank',
      accountNumber: '0123456789',
      accountHolderName: 'Cron Test Op',
      verifiedAt: new Date(),
      verifyMethod: 'name_match',
    },
  });

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 40, licensePlate: 'CRON-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: {
      origin: 'Cron Origin',
      destination: 'Cron Destination',
      operatorId,
      durationMinutes: 90,
    },
  });
  routeId = route.id;
});

afterAll(async () => {
  // Reverse FK order.
  await prisma.notificationLog.deleteMany({
    where: { booking: { trip: { operatorId } } },
  });
  // processPayouts writes payout_debit LedgerEntry rows (FK → operatorId). Ledger
  // is append-only (immutability trigger) — drop/recreate to clean up this
  // operator's rows before deleting the operator (else LedgerEntry_operatorId_fkey).
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
  await prisma.payoutAccount.deleteMany({ where: { operatorId } });
  await prisma.hold.deleteMany({ where: { trip: { operatorId } } });
  await prisma.booking.deleteMany({ where: { trip: { operatorId } } });
  await prisma.recurringGenerationLog.deleteMany({
    where: { template: { operatorId } },
  });
  await prisma.trip.deleteMany({ where: { operatorId } });
  await prisma.recurringTripTemplate.deleteMany({ where: { operatorId } });
  await prisma.jobRunLog.deleteMany({ where: { jobName: 'trip-generate' } });
  await prisma.route.deleteMany({ where: { operatorId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.deleteMany({ where: { id: operatorId } });
});

// ────────────────────────────────────────────────────────────────────────────
// AC1 — expireHolds
// ────────────────────────────────────────────────────────────────────────────

describe('AC1 expireHolds', () => {
  it('flips an active hold past expiresAt to expired', async () => {
    const tripId = await createTrip(new Date(Date.now() + 10 * 86_400_000), 'scheduled', false);
    const hold = await prisma.hold.create({
      data: {
        tripId,
        ticketCount: 1,
        customerPhone: '+8490xxxxxx3',
        customerName: 'Hold Tester',
        expiresAt: new Date(Date.now() - 60_000), // 1 min ago
        status: 'active',
      },
    });

    await prisma.$transaction((tx) => expireHolds(tx));

    const row = await prisma.hold.findUnique({ where: { id: hold.id }, select: { status: true } });
    expect(row?.status).toBe('expired');
  });

  it('leaves a not-yet-expired active hold untouched', async () => {
    const tripId = await createTrip(new Date(Date.now() + 10 * 86_400_000), 'scheduled', false);
    const hold = await prisma.hold.create({
      data: {
        tripId,
        ticketCount: 1,
        customerPhone: '+8490xxxxxx4',
        customerName: 'Future Hold',
        expiresAt: new Date(Date.now() + 5 * 60_000), // 5 min out
        status: 'active',
      },
    });

    await prisma.$transaction((tx) => expireHolds(tx));

    const row = await prisma.hold.findUnique({ where: { id: hold.id }, select: { status: true } });
    expect(row?.status).toBe('active');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AC2 — autoCloseSales
// ────────────────────────────────────────────────────────────────────────────

describe('AC2 autoCloseSales', () => {
  it('sets salesClosed=true on a scheduled trip whose departure has arrived', async () => {
    const tripId = await createTrip(new Date(Date.now() - 60_000), 'scheduled', false);

    await prisma.$transaction((tx) => autoCloseSales(tx));

    const row = await prisma.trip.findUnique({ where: { id: tripId }, select: { salesClosed: true } });
    expect(row?.salesClosed).toBe(true);
  });

  it('leaves a future scheduled trip open', async () => {
    const tripId = await createTrip(new Date(Date.now() + 86_400_000), 'scheduled', false);

    await prisma.$transaction((tx) => autoCloseSales(tx));

    const row = await prisma.trip.findUnique({ where: { id: tripId }, select: { salesClosed: true } });
    expect(row?.salesClosed).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AC3 — autoCompleteTrips + Payout creation
// ────────────────────────────────────────────────────────────────────────────

describe('AC3 autoCompleteTrips', () => {
  it('completes a departed trip past its duration and creates one Payout row', async () => {
    // durationMinutes=90; departed 100 min ago → departureAt + 90m is in the past.
    const departureAt = new Date(Date.now() - 100 * 60_000);
    const tripId = await createTrip(departureAt, 'departed', true, { departedAt: departureAt });
    await createBooking(tripId, 'BB-2026-cron-ac31', 'paid', 150_000);

    await prisma.$transaction((tx) => autoCompleteTrips(tx));

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { status: true, completedAt: true },
    });
    expect(trip?.status).toBe('completed');
    expect(trip?.completedAt).not.toBeNull();

    const payouts = await prisma.payout.findMany({ where: { tripId } });
    expect(payouts.length).toBe(1);
    const payout = payouts[0];
    expect(payout.gross).toBe(BigInt(150_000));
    expect(payout.platformFee + payout.net).toBe(payout.gross);
    // completeTripCore creates the trip Payout in 'requested' (the sweep then
    // transitions requested → processing → paid). 'pending' was a stale guess.
    expect(payout.status).toBe('requested');

    // scheduledAt ≈ completedAt + 1 day (T+1, S15#5) (±60s).
    const ONE_DAY_MS = 1 * 24 * 60 * 60 * 1000;
    const expected = trip!.completedAt!.getTime() + ONE_DAY_MS;
    expect(Math.abs(payout.scheduledAt.getTime() - expected)).toBeLessThan(60_000);
  });

  it('does not touch a departed trip still within its duration', async () => {
    // departed 10 min ago, duration 90m → not yet elapsed.
    const departureAt = new Date(Date.now() - 10 * 60_000);
    const tripId = await createTrip(departureAt, 'departed', true, { departedAt: departureAt });

    await prisma.$transaction((tx) => autoCompleteTrips(tx));

    const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { status: true } });
    expect(trip?.status).toBe('departed');
    const payouts = await prisma.payout.findMany({ where: { tripId } });
    expect(payouts.length).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AC4 — sendReminders (fires once)
// ────────────────────────────────────────────────────────────────────────────

describe('AC4 sendReminders', () => {
  it('sends the 24h reminder exactly once per booking', async () => {
    // Departure 24h out → inside the 23–25h window.
    const tripId = await createTrip(new Date(Date.now() + 24 * 3_600_000), 'scheduled', false);
    const bookingId = await createBooking(tripId, 'BB-2026-cron-ac41', 'paid');

    await sendReminders();

    let logs = await prisma.notificationLog.findMany({
      where: { bookingId, template: 'bookingReminder24h' },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe('sent');

    const afterFirst = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { reminderSentAt: true },
    });
    expect(afterFirst?.reminderSentAt).not.toBeNull();

    // Second run must NOT re-fire for this booking (reminderSentAt guard).
    await sendReminders();

    logs = await prisma.notificationLog.findMany({
      where: { bookingId, template: 'bookingReminder24h' },
    });
    expect(logs.length).toBe(1);
  });

  it('does not remind a booking outside the 23–25h window', async () => {
    const tripId = await createTrip(new Date(Date.now() + 48 * 3_600_000), 'scheduled', false);
    const bookingId = await createBooking(tripId, 'BB-2026-cron-ac42', 'paid');

    await sendReminders();

    const logs = await prisma.notificationLog.findMany({
      where: { bookingId, template: 'bookingReminder24h' },
    });
    expect(logs.length).toBe(0);
    const row = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { reminderSentAt: true },
    });
    expect(row?.reminderSentAt).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AC5 — processPayouts transitions
// ────────────────────────────────────────────────────────────────────────────

describe('AC5 processPayouts', () => {
  async function createDuePayout(): Promise<string> {
    const tripId = await createTrip(new Date(Date.now() - 5 * 86_400_000), 'completed', true);
    const payout = await prisma.payout.create({
      data: {
        tripId,
        operatorId,
        gross: BigInt(150_000),
        platformFee: BigInt(9_000),
        net: BigInt(141_000),
        status: 'requested',
        scheduledAt: new Date(Date.now() - 60_000), // due (past)
      },
    });
    return payout.id;
  }

  it('happy path: requested → paid', async () => {
    const payoutId = await createDuePayout();

    await prisma.$transaction((tx) => processPayouts(tx));

    const row = await prisma.payout.findUnique({
      where: { id: payoutId },
      select: { status: true, settledAt: true, failureReason: true },
    });
    expect(row?.status).toBe('paid');
    expect(row?.settledAt).not.toBeNull();
    expect(row?.failureReason).toBeNull();
  });

  it('forced failure: requested → failed with failureReason', async () => {
    const payoutId = await createDuePayout();

    process.env.PAYOUT_SETTLEMENT_FORCE_FAIL = 'true';
    _resetEnvCache();
    try {
      await prisma.$transaction((tx) => processPayouts(tx));
    } finally {
      delete process.env.PAYOUT_SETTLEMENT_FORCE_FAIL;
      _resetEnvCache();
    }

    const row = await prisma.payout.findUnique({
      where: { id: payoutId },
      select: { status: true, settledAt: true, failureReason: true },
    });
    expect(row?.status).toBe('failed');
    expect(row?.failureReason).toBe('settlement_forced_fail');
    expect(row?.settledAt).toBeNull();
  });

  // Issue 078: a due payout for an operator WITHOUT a verified payout account is
  // SKIPPED — left `requested` (not paid, no debit) for a later sweep.
  it('Issue 078: skips a due payout when the operator has no verified payout account', async () => {
    const unverifiedOp = await prisma.operator.create({
      data: {
        legalName: 'Unverified Payout Op',
        contactPhone: '+8490xxxxxx7',
        contactEmail: 'unverified@test.dev',
      },
    });
    const bus = await prisma.bus.create({
      data: { operatorId: unverifiedOp.id, capacity: 20, licensePlate: 'CRON-UNV', busType: 'coach' },
    });
    const route = await prisma.route.create({
      data: { origin: 'A', destination: 'B', operatorId: unverifiedOp.id, durationMinutes: 60 },
    });
    const trip = await prisma.trip.create({
      data: {
        operatorId: unverifiedOp.id,
        busId: bus.id,
        routeId: route.id,
        departureAt: new Date(Date.now() - 5 * 86_400_000),
        price: 100_000,
        status: 'completed',
        salesClosed: true,
        completedAt: new Date(Date.now() - 4 * 86_400_000),
      },
    });
    const payout = await prisma.payout.create({
      data: {
        tripId: trip.id,
        operatorId: unverifiedOp.id,
        gross: BigInt(100_000),
        platformFee: BigInt(6_000),
        net: BigInt(94_000),
        status: 'requested',
        scheduledAt: new Date(Date.now() - 60_000), // due
      },
    });

    try {
      await prisma.$transaction((tx) => processPayouts(tx));

      const row = await prisma.payout.findUnique({
        where: { id: payout.id },
        select: { status: true, settledAt: true },
      });
      // Skipped — still requested, never settled, no debit written.
      expect(row?.status).toBe('requested');
      expect(row?.settledAt).toBeNull();
      const debits = await prisma.ledgerEntry.findMany({ where: { payoutId: payout.id } });
      expect(debits).toHaveLength(0);
    } finally {
      // Cleanup in reverse-FK order.
      await prisma.ledgerEntry.deleteMany({ where: { operatorId: unverifiedOp.id } });
      await prisma.payout.deleteMany({ where: { operatorId: unverifiedOp.id } });
      await prisma.trip.deleteMany({ where: { operatorId: unverifiedOp.id } });
      await prisma.route.deleteMany({ where: { operatorId: unverifiedOp.id } });
      await prisma.bus.deleteMany({ where: { operatorId: unverifiedOp.id } });
      await prisma.operator.deleteMany({ where: { id: unverifiedOp.id } });
    }
  });

  it('does not process a payout scheduled in the future', async () => {
    const tripId = await createTrip(new Date(Date.now() - 86_400_000), 'completed', true);
    const payout = await prisma.payout.create({
      data: {
        tripId,
        operatorId,
        gross: BigInt(100_000),
        platformFee: BigInt(6_000),
        net: BigInt(94_000),
        status: 'requested',
        scheduledAt: new Date(Date.now() + 3 * 86_400_000), // not due
      },
    });

    await prisma.$transaction((tx) => processPayouts(tx));

    const row = await prisma.payout.findUnique({ where: { id: payout.id }, select: { status: true } });
    expect(row?.status).toBe('requested');
  });

  // Issue 050 Part C: the requested → paid transition appends a payout_debit
  // ledger entry (amount = −net) in the same tx. sourceEventId is unique per
  // payout, so two sweeps must leave exactly ONE payout_debit row.
  it('Issue 050: paid transition writes ONE payout_debit ledger entry (idempotent)', async () => {
    const payoutId = await createDuePayout();
    const payout = await prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
      select: { net: true, operatorId: true },
    });

    // Run the sweep twice. The first flips requested → paid + writes the debit;
    // the second finds nothing 'requested' (no-op) — and even if it re-selected,
    // the unique sourceEventId would make the ledger append a no-op.
    await prisma.$transaction((tx) => processPayouts(tx));
    await prisma.$transaction((tx) => processPayouts(tx));

    const debits = await prisma.ledgerEntry.findMany({
      where: { payoutId, type: 'payout_debit' },
      select: { amount: true, operatorId: true, sourceEventId: true },
    });
    expect(debits).toHaveLength(1);
    expect(debits[0].amount).toBe(-payout.net);
    expect(debits[0].operatorId).toBe(payout.operatorId);
    expect(debits[0].sourceEventId).toBe(`payout_debit:${payoutId}`);

    // And the operator's paidOut bucket reflects the debit magnitude.
    const { getOperatorBalance } = await import('@/lib/ledger');
    const bal = await getOperatorBalance(payout.operatorId);
    expect(bal.paidOut).toBeGreaterThanOrEqual(BigInt(payout.net));
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AC6 — withAdvisoryLock mutual exclusion
// ────────────────────────────────────────────────────────────────────────────

describe('AC6 withAdvisoryLock', () => {
  it('returns skipped_locked (core does not run) while another tx holds the lock', async () => {
    const jobName = 'test-lock-' + randomUUID().slice(0, 8);
    let coreRan = false;
    const spyCore: JobCore = async () => {
      coreRan = true;
      return { rowsAffected: 1, status: 'success' };
    };

    // Hold the same advisory key in an open transaction until we release it.
    let release!: () => void;
    const held = new Promise<void>((r) => {
      release = r;
    });
    const holding = prisma.$transaction(async (tx) => {
      // $executeRaw (not $queryRaw): pg_advisory_xact_lock returns void, which
      // the pg driver adapter can't deserialize as a result column.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${jobName}))`;
      await held;
    });

    // Let the holding tx acquire the lock first.
    await new Promise((r) => setTimeout(r, 250));

    const result = await withAdvisoryLock(jobName, spyCore);

    release();
    await holding;

    expect(result.status).toBe('skipped_locked');
    expect(result.rowsAffected).toBe(0);
    expect(coreRan).toBe(false);
  });

  it('runs the core and returns its result when the lock is free', async () => {
    const jobName = 'test-lock-' + randomUUID().slice(0, 8);
    let coreRan = false;
    const spyCore: JobCore = async () => {
      coreRan = true;
      return { rowsAffected: 7, status: 'success' };
    };

    const result = await withAdvisoryLock(jobName, spyCore);

    expect(coreRan).toBe(true);
    expect(result.status).toBe('success');
    expect(result.rowsAffected).toBe(7);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// I43 — generate-trips hardening (advisory lock + JobRunLog + idempotency)
//
// generateTrips runs under runJob('trip-generate', ...) exactly like the other
// five crons. These tests mirror AC6 (lock mutual exclusion) for this specific
// job key, assert one JobRunLog row per runJob invocation, and confirm the
// underlying generation logic is unchanged (idempotent across two runs).
// ────────────────────────────────────────────────────────────────────────────

describe('I43 generateTrips (trip-generate job)', () => {
  // Seed a template that fires every day across the 14-day horizon, so trips
  // generate regardless of the wall-clock day the test runs.
  async function seedDailyTemplate(): Promise<string> {
    const today = new Date();
    const validFrom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const validUntil = new Date(validFrom.getTime() + 30 * 86_400_000);
    const t = await prisma.recurringTripTemplate.create({
      data: {
        operatorId,
        routeId,
        busId,
        price: 120_000,
        departureLocalTime: '08:30',
        daysOfMask: 127, // all 7 days
        validFrom,
        validUntil,
      },
    });
    return t.id;
  }

  it('writes exactly one JobRunLog row per runJob invocation and generates trips', async () => {
    const templateId = await seedDailyTemplate();

    const before = await prisma.jobRunLog.count({ where: { jobName: 'trip-generate' } });
    const result = await runJob('trip-generate', generateTrips);
    const after = await prisma.jobRunLog.count({ where: { jobName: 'trip-generate' } });

    expect(result.status).toBe('success');
    // 14-day horizon, every day fires → 14 trips on a fresh template.
    expect(result.rowsAffected).toBeGreaterThan(0);
    expect(after - before).toBe(1);

    const trips = await prisma.trip.count({ where: { recurringTemplateId: templateId } });
    expect(trips).toBe(result.rowsAffected);
  });

  it('is idempotent: a second run generates no new trips (per-row guard intact)', async () => {
    const templateId = await seedDailyTemplate();

    const first = await runJob('trip-generate', generateTrips);
    const tripsAfterFirst = await prisma.trip.count({ where: { recurringTemplateId: templateId } });
    expect(first.rowsAffected).toBeGreaterThan(0);

    const second = await runJob('trip-generate', generateTrips);
    const tripsAfterSecond = await prisma.trip.count({ where: { recurringTemplateId: templateId } });

    // Second run regenerates nothing for this template; row count is stable.
    expect(tripsAfterSecond).toBe(tripsAfterFirst);
    // Two runJob invocations → two JobRunLog rows.
    const logs = await prisma.jobRunLog.count({ where: { jobName: 'trip-generate' } });
    expect(logs).toBeGreaterThanOrEqual(2);
    expect(second.status).toBe('success');
  });

  it('a concurrent tick returns skipped_locked while the trip-generate key is held', async () => {
    // Hold the real 'trip-generate' advisory key in an open tx, then fire the
    // job through runJob → withAdvisoryLock and assert it skips without running.
    let release!: () => void;
    const held = new Promise<void>((r) => {
      release = r;
    });
    const holding = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'trip-generate'}))`;
      await held;
    });

    // Let the holding tx acquire the lock first.
    await new Promise((r) => setTimeout(r, 250));

    const result = await runJob('trip-generate', generateTrips);

    release();
    await holding;

    expect(result.status).toBe('skipped_locked');
    expect(result.rowsAffected).toBe(0);
  });
});
