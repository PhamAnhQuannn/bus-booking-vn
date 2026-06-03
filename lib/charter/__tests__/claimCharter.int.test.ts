/**
 * Issue 084 — claimCharter integration tests (DB-gated). Run with: pnpm vitest:int
 *
 * AC2 (REQUIRED, Mistake Log Issue 011): the first-accept-wins concurrency proof.
 * Two APPROVED operators fire claimCharter on the SAME PUBLISHED pool item via
 * Promise.all + real transactions. The atomic conditional UPDATE
 * (`WHERE status='PUBLISHED' AND assigneeOperatorId IS NULL AND claimByAt-ok`)
 * guarantees EXACTLY ONE rowcount-1 → exactly one { ok:true }; the loser gets
 * { ok:false, reason:'already_claimed' }. The row's final assigneeOperatorId is the
 * winner and status is ACCEPTED. Exactly one set of WIN notifications is enqueued.
 *
 * Sequential cases: claiming an already-ACCEPTED request → already_claimed; claiming
 * an expired-claimByAt pool item → already_claimed (the claimByAt guard); claiming
 * a non-existent id → not_found.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db/client';
import { claimCharter } from '../claimCharter';
import { generateCharterRef } from '../charterRef';

let op1Id: string;
let op2Id: string;
const createdCharterIds: string[] = [];
const createdRefs: string[] = [];

async function makePublishedPoolItem(opts?: { claimByAt?: Date | null; status?: string }): Promise<string> {
  const ref = generateCharterRef();
  createdRefs.push(ref);
  const row = await prisma.charterRequest.create({
    data: {
      ref,
      contactName: 'Charter Pool Tester',
      contactPhone: '+8490xxxxxx5',
      contactEmail: 'pool@charter.dev',
      destinations: ['Đà Lạt'],
      startDate: new Date(Date.now() + 7 * 86_400_000),
      passengers: 25,
      vehicleType: 'coach',
      // status PUBLISHED, unclaimed, future claimByAt unless overridden.
      status: (opts?.status ?? 'PUBLISHED') as 'PUBLISHED',
      claimByAt: opts && 'claimByAt' in opts ? opts.claimByAt : new Date(Date.now() + 2 * 86_400_000),
    },
    select: { id: true },
  });
  createdCharterIds.push(row.id);
  return row.id;
}

beforeAll(async () => {
  const op1 = await prisma.operator.create({
    data: {
      legalName: 'Claim Op 1',
      contactPhone: '+8490xxxxxx6',
      contactEmail: 'op1@claim.dev',
      status: 'APPROVED',
    },
  });
  op1Id = op1.id;
  const op2 = await prisma.operator.create({
    data: {
      legalName: 'Claim Op 2',
      contactPhone: '+8490xxxxxx7',
      contactEmail: 'op2@claim.dev',
      status: 'APPROVED',
    },
  });
  op2Id = op2.id;
});

afterEach(async () => {
  // Clean notification rows seeded by wins, keyed on the refs created this file.
  if (createdRefs.length) {
    await prisma.notificationLog.deleteMany({
      where: { template: { in: ['charterMatched', 'charterClaimWon'] } },
    });
  }
});

afterAll(async () => {
  if (createdCharterIds.length) {
    await prisma.charterRequest.deleteMany({ where: { id: { in: createdCharterIds } } });
  }
  await prisma.operator.deleteMany({ where: { id: { in: [op1Id, op2Id] } } });
});

describe('claimCharter — first-accept-wins concurrency (AC2)', () => {
  it('two racers on the same pool item → EXACTLY one win, one already_claimed', async () => {
    const charterId = await makePublishedPoolItem();

    const [r1, r2] = await Promise.all([
      claimCharter(prisma, { charterId, operatorId: op1Id }),
      claimCharter(prisma, { charterId, operatorId: op2Id }),
    ]);

    const wins = [r1, r2].filter((r) => r.ok);
    const losses = [r1, r2].filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect(losses[0]).toEqual({ ok: false, reason: 'already_claimed' });

    // The committed row: ACCEPTED + assigned to exactly one of the two racers.
    const row = await prisma.charterRequest.findUnique({
      where: { id: charterId },
      select: { status: true, assigneeOperatorId: true },
    });
    expect(row?.status).toBe('ACCEPTED');
    expect([op1Id, op2Id]).toContain(row?.assigneeOperatorId);

    // Exactly one WIN: one charterClaimWon sms enqueued (to the winning operator).
    const winSms = await prisma.notificationLog.count({
      where: { template: 'charterClaimWon', channel: 'sms' },
    });
    expect(winSms).toBe(1);
    // And exactly one charterMatched sms to the customer.
    const matchSms = await prisma.notificationLog.count({
      where: { template: 'charterMatched', channel: 'sms', recipient: '+8490xxxxxx5' },
    });
    expect(matchSms).toBe(1);
  });
});

describe('claimCharter — sequential guards', () => {
  it('claiming an already-ACCEPTED request → already_claimed', async () => {
    const charterId = await makePublishedPoolItem();
    const first = await claimCharter(prisma, { charterId, operatorId: op1Id });
    expect(first.ok).toBe(true);

    const second = await claimCharter(prisma, { charterId, operatorId: op2Id });
    expect(second).toEqual({ ok: false, reason: 'already_claimed' });
  });

  it('claiming an expired-claimByAt pool item → already_claimed (not claimable)', async () => {
    const charterId = await makePublishedPoolItem({ claimByAt: new Date(Date.now() - 60_000) });
    const res = await claimCharter(prisma, { charterId, operatorId: op1Id });
    expect(res).toEqual({ ok: false, reason: 'already_claimed' });

    // Row stays PUBLISHED + unclaimed (the expired guard rejected the UPDATE).
    const row = await prisma.charterRequest.findUnique({
      where: { id: charterId },
      select: { status: true, assigneeOperatorId: true },
    });
    expect(row?.status).toBe('PUBLISHED');
    expect(row?.assigneeOperatorId).toBeNull();
  });

  it('claiming a non-existent id → not_found', async () => {
    const res = await claimCharter(prisma, { charterId: 'ch_does_not_exist', operatorId: op1Id });
    expect(res).toEqual({ ok: false, reason: 'not_found' });
  });
});
