/**
 * Unit tests for lib/admin/getActionQueue.ts (Issue 064).
 *
 * Prisma counts are injected via the PrismaLike param — each count returns a
 * distinct number so we can assert the mapping (pending→operator,
 * disputes→ledgerEntry, failed→payout) is wired correctly, plus the exact where
 * clauses (enum values sourced from schema.prisma).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// getActionQueue imports the real prisma client for its DEFAULT param; stub the
// module so importing it doesn't try to open a DB connection at load time. Every
// test injects its own prismaStub, so the default is never exercised.
vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { getActionQueue } from '../getActionQueue';

const operatorCount = vi.fn();
const charterCount = vi.fn();
const ledgerCount = vi.fn();
const payoutCount = vi.fn();

const prismaStub = {
  operator: { count: operatorCount },
  charterRequest: { count: charterCount },
  ledgerEntry: { count: ledgerCount },
  payout: { count: payoutCount },
} as unknown as Parameters<typeof getActionQueue>[0];

describe('getActionQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    operatorCount.mockResolvedValue(3);
    charterCount.mockResolvedValue(4);
    ledgerCount.mockResolvedValue(2);
    payoutCount.mockResolvedValue(1);
  });

  it('maps each count to the right field', async () => {
    const result = await getActionQueue(prismaStub);
    expect(result).toEqual({
      pendingApprovals: 3,
      pendingCharters: 4,
      openDisputes: 2,
      failedPayouts: 1,
    });
  });

  it('counts pending approvals with PENDING_REVIEW + UNDER_REVIEW operator statuses', async () => {
    await getActionQueue(prismaStub);
    expect(operatorCount).toHaveBeenCalledWith({
      where: { status: { in: ['PENDING_REVIEW', 'UNDER_REVIEW'] } },
    });
  });

  it('counts pending charters with ADMIN_REVIEW charter status (085 dispatch surface)', async () => {
    await getActionQueue(prismaStub);
    expect(charterCount).toHaveBeenCalledWith({ where: { status: 'ADMIN_REVIEW' } });
  });

  it('counts open disputes as chargeback ledger entries', async () => {
    await getActionQueue(prismaStub);
    expect(ledgerCount).toHaveBeenCalledWith({ where: { type: 'chargeback' } });
  });

  it('counts failed payouts with status failed', async () => {
    await getActionQueue(prismaStub);
    expect(payoutCount).toHaveBeenCalledWith({ where: { status: 'failed' } });
  });

  it('returns zeroes when nothing is queued', async () => {
    operatorCount.mockResolvedValue(0);
    charterCount.mockResolvedValue(0);
    ledgerCount.mockResolvedValue(0);
    payoutCount.mockResolvedValue(0);
    const result = await getActionQueue(prismaStub);
    expect(result).toEqual({
      pendingApprovals: 0,
      pendingCharters: 0,
      openDisputes: 0,
      failedPayouts: 0,
    });
  });
});
