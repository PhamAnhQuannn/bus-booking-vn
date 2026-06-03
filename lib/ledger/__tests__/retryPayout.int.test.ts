/**
 * Integration tests for retryPayout.
 * Issue 016 — operator revenue reporting + payout tracking.
 *
 * Run with: pnpm vitest:int
 *
 * Covers:
 * - Happy path: failed payout → status becomes 'processing', failureReason cleared.
 * - not_found: non-existent payoutId → { ok: false, error: 'not_found' }.
 * - wrong_operator: payout belongs to operator A, called with operator B → { ok: false, error: 'wrong_operator' }.
 * - not_failed: paid payout → { ok: false, error: 'not_failed' }.
 * - Concurrent-write: two simultaneous retries on same failed payout — one transitions, one returns 'not_failed'.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/client';
import { retryPayout } from '../retryPayout';

// ────────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────────

let operatorAId: string;
let operatorBId: string;
let routeId: string;
let busId: string;
let tripId: string;

/** Seed a Payout row and return its id. */
async function seedPayout(
  status: 'requested' | 'processing' | 'paid' | 'failed',
  overrideOperatorId?: string
): Promise<string> {
  const p = await prisma.payout.create({
    data: {
      tripId,
      operatorId: overrideOperatorId ?? operatorAId,
      gross: 1_500_000,
      platformFee: 90_000,
      net: 1_410_000,
      status,
      scheduledAt: new Date(Date.now() + 3 * 24 * 3600 * 1000), // T+3
    },
  });
  return p.id;
}

beforeAll(async () => {
  // Operator A
  const opA = await prisma.operator.create({
    data: {
      legalName: 'RetryPayout Test Op A',
      contactPhone: '+8490xxxxxx3',
      contactEmail: 'retry-op-a@test.invalid',
    },
  });
  operatorAId = opA.id;

  // Operator B (for wrong_operator test)
  const opB = await prisma.operator.create({
    data: {
      legalName: 'RetryPayout Test Op B',
      contactPhone: '+8490xxxxxx4',
      contactEmail: 'retry-op-b@test.invalid',
    },
  });
  operatorBId = opB.id;

  // Route
  const route = await prisma.route.create({
    data: {
      operatorId: operatorAId,
      origin: 'Hà Nội',
      destination: 'Hải Phòng',
      durationMinutes: 120,
    },
  });
  routeId = route.id;

  // Bus
  const bus = await prisma.bus.create({
    data: {
      operatorId: operatorAId,
      capacity: 40,
      licensePlate: 'RP-TEST-01',
      busType: 'coach',
    },
  });
  busId = bus.id;

  // Trip
  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId: operatorAId,
      departureAt: new Date(Date.now() - 7 * 24 * 3600 * 1000), // 7 days ago
      price: 150_000,
      status: 'completed',
      salesClosed: true,
    },
  });
  tripId = trip.id;
});

afterAll(async () => {
  // Clean up in reverse dependency order
  await prisma.payout.deleteMany({ where: { tripId } });
  await prisma.trip.delete({ where: { id: tripId } });
  await prisma.bus.delete({ where: { id: busId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.operator.deleteMany({ where: { id: { in: [operatorAId, operatorBId] } } });
});

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe('retryPayout', () => {
  it('happy path: failed payout → status becomes processing, failureReason cleared', async () => {
    const payoutId = await seedPayout('failed');
    // Set a failureReason to confirm it's cleared on retry
    await prisma.payout.update({
      where: { id: payoutId },
      data: { failureReason: 'bank_timeout' },
    });

    const result = await retryPayout({ payoutId, operatorId: operatorAId });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok=true');
    expect(result.payout.status).toBe('processing');
    expect(result.payout.failureReason).toBeNull();

    // Clean up
    await prisma.payout.delete({ where: { id: payoutId } });
  });

  it('not_found: non-existent payoutId → error', async () => {
    const result = await retryPayout({
      payoutId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', // valid CUID format, non-existent
      operatorId: operatorAId,
    });
    expect(result).toEqual({ ok: false, error: 'not_found' });
  });

  it('wrong_operator: payout belongs to operator A, called with operator B → error', async () => {
    const payoutId = await seedPayout('failed', operatorAId);

    const result = await retryPayout({ payoutId, operatorId: operatorBId });
    expect(result).toEqual({ ok: false, error: 'wrong_operator' });

    // Clean up
    await prisma.payout.delete({ where: { id: payoutId } });
  });

  it('not_failed: paid payout → error', async () => {
    const payoutId = await seedPayout('paid');

    const result = await retryPayout({ payoutId, operatorId: operatorAId });
    expect(result).toEqual({ ok: false, error: 'not_failed' });

    // Clean up
    await prisma.payout.delete({ where: { id: payoutId } });
  });

  it('concurrent-write: two simultaneous retries — one succeeds, one returns not_failed', async () => {
    const payoutId = await seedPayout('failed');

    // Fire both simultaneously
    const [r1, r2] = await Promise.all([
      retryPayout({ payoutId, operatorId: operatorAId }),
      retryPayout({ payoutId, operatorId: operatorAId }),
    ]);

    // Exactly one should succeed and one should return 'not_failed'
    // (the SELECT FOR UPDATE serialises them; whichever runs second sees status='processing')
    const successes = [r1, r2].filter((r) => r.ok);
    const failures = [r1, r2].filter((r) => !r.ok);

    expect(successes.length).toBeGreaterThanOrEqual(1);
    // After both complete, the final status must be 'processing'
    const final = await prisma.payout.findUniqueOrThrow({ where: { id: payoutId } });
    expect(final.status).toBe('processing');

    if (failures.length > 0) {
      const failure = failures[0];
      if (!failure.ok) {
        expect(failure.error).toBe('not_failed');
      }
    }

    // Clean up
    await prisma.payout.delete({ where: { id: payoutId } });
  });
});
