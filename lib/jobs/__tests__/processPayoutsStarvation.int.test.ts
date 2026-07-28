/**
 * CLAIM_LIMIT starvation gate (#364).
 *
 * Requires a real PostgreSQL database. Run with: pnpm vitest:int
 *
 * WHAT THIS PROVES.
 *
 * #364 bounds one processPayouts tick to CLAIM_LIMIT rows, ordered `scheduledAt ASC`.
 * The unverified-payout-account guard skips its row WITHOUT changing `status` or
 * `scheduledAt`, so a skipped payout stays in the candidate set forever — and being the
 * oldest, it sorts FIRST. One operator who never verifies their account and accumulates
 * CLAIM_LIMIT due payouts therefore consumes the whole budget on every tick, and no other
 * operator is ever reached. `rowsAffected` reads 0, which is indistinguishable from idle.
 *
 * That is the 2026-07-24 "permanent hold starves a bounded work queue" pattern from the
 * mistake log. Adding the LIMIT is what arms it — before #364 the query was unbounded, so
 * the stuck rows were harmless.
 *
 * The fixture is the minimum that can actually reproduce it: CLAIM_LIMIT older due
 * payouts for an UNVERIFIED operator, plus one newer due payout for a VERIFIED one. A
 * smaller fixture proves nothing, because with the budget unfilled the verified row is
 * reached either way — the starvation only exists at the boundary.
 *
 * Against the claim-then-skip implementation this test FAILS: the verified payout is
 * still `requested`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { processPayouts } from '../processPayouts';

/** Must match CLAIM_LIMIT in ../processPayouts — the fixture only bites at the boundary. */
const CLAIM_LIMIT = 200;

let unverifiedOperatorId: string;
let verifiedOperatorId: string;
let verifiedPayoutId: string;

beforeAll(async () => {
  const unverified = await prisma.operator.create({
    data: {
      legalName: 'Starvation Unverified Operator',
      contactPhone: '+8490xxxxxx4',
      contactEmail: 'unverified@starvation.test',
      status: 'APPROVED',
    },
  });
  unverifiedOperatorId = unverified.id;

  // Registered but NEVER verified — exactly the operator whose rows pile up.
  await prisma.payoutAccount.create({
    data: {
      operatorId: unverifiedOperatorId,
      bankName: 'Test Bank',
      accountNumber: '0000000001',
      accountHolderName: 'STARVATION UNVERIFIED',
      verifiedAt: null,
    },
  });

  const verified = await prisma.operator.create({
    data: {
      legalName: 'Starvation Verified Operator',
      contactPhone: '+8490xxxxxx5',
      contactEmail: 'verified@starvation.test',
      status: 'APPROVED',
    },
  });
  verifiedOperatorId = verified.id;

  await prisma.payoutAccount.create({
    data: {
      operatorId: verifiedOperatorId,
      bankName: 'Test Bank',
      accountNumber: '0000000002',
      accountHolderName: 'STARVATION VERIFIED',
      verifiedAt: new Date(),
      verifyMethod: 'name_match',
    },
  });

  // CLAIM_LIMIT stuck rows, all OLDER than the verified one so they sort first.
  const base = Date.now() - 30 * 86_400_000;
  await prisma.payout.createMany({
    data: Array.from({ length: CLAIM_LIMIT }, (_, i) => ({
      operatorId: unverifiedOperatorId,
      tripId: null,
      gross: BigInt(150_000),
      platformFee: BigInt(9_000),
      net: BigInt(141_000),
      status: 'requested' as const,
      scheduledAt: new Date(base + i * 1_000),
    })),
  });

  // Due, payable, and NEWEST — so only the budget can keep it from being settled.
  const payable = await prisma.payout.create({
    data: {
      operatorId: verifiedOperatorId,
      tripId: null,
      gross: BigInt(200_000),
      platformFee: BigInt(12_000),
      net: BigInt(188_000),
      status: 'requested',
      scheduledAt: new Date(Date.now() - 60_000),
    },
  });
  verifiedPayoutId = payable.id;
});

afterAll(async () => {
  // Payouts and payout accounts only. LedgerEntry is append-only — a DB trigger rejects
  // DELETE — so the payout_debit this test writes cannot be removed, and its FK keeps the
  // operator rows alive too. Clearing the payouts is what matters: 200 lingering
  // `requested` rows would otherwise sit in every later tick's candidate scan.
  await prisma.payout.deleteMany({
    where: { operatorId: { in: [unverifiedOperatorId, verifiedOperatorId] } },
  });
  await prisma.payoutAccount.deleteMany({
    where: { operatorId: { in: [unverifiedOperatorId, verifiedOperatorId] } },
  });
});

describe('processPayouts CLAIM_LIMIT starvation (#364)', () => {
  it('settles a payable payout even when CLAIM_LIMIT older unpayable ones exist', async () => {
    await prisma.$transaction((tx) => processPayouts(tx));

    const row = await prisma.payout.findUnique({
      where: { id: verifiedPayoutId },
      select: { status: true, settledAt: true },
    });

    // Still 'requested' IS the starvation: the budget was spent entirely on rows that
    // could never progress, and this operator is never paid — on this tick or any other.
    expect(row?.status).toBe('paid');
    expect(row?.settledAt).not.toBeNull();
  });

  it('leaves the unpayable rows untouched rather than consuming or failing them', async () => {
    // The other direction: excluding them from the budget must not quietly settle or
    // terminally fail them. They stay `requested` and get paid once verification lands.
    const stuck = await prisma.payout.count({
      where: { operatorId: unverifiedOperatorId, status: 'requested' },
    });
    expect(stuck).toBe(CLAIM_LIMIT);
  });
});
