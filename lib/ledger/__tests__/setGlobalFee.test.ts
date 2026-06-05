/**
 * Issue 068: unit tests for setGlobalFee.
 *
 * Proves the global-scope, effective-dated, never-edit-in-place contract
 * (AGENTS.md Issue 013):
 *   - a NEW FeeConfig row with operatorId: null is CREATED, NOT an update;
 *   - the prior open GLOBAL row is closed via updateMany pinned to operatorId: null
 *     (must NEVER close per-operator overrides);
 *   - an audit row (action: 'global-fee-change') is written in the SAME transaction;
 *   - an out-of-range / non-integer ratePpm is rejected before any write.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));

import { setGlobalFee, GlobalFeeError, MAX_GLOBAL_FEE_PPM } from '../setGlobalFee';

interface Calls {
  createData: unknown[];
  updateManyArgs: unknown[];
  auditData: unknown[];
}

function fakePrisma(calls: Calls) {
  const tx = {
    feeConfig: {
      create: vi.fn(async (args: { data: unknown }) => {
        calls.createData.push(args.data);
        return { id: 'fc_global_new' };
      }),
      updateMany: vi.fn(async (args: unknown) => {
        calls.updateManyArgs.push(args);
        return { count: 1 };
      }),
    },
    adminAuditLog: {
      create: vi.fn(async (args: { data: unknown }) => {
        calls.auditData.push(args.data);
        return {};
      }),
    },
  };
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: async <T>(fn: (t: any) => Promise<T>) => fn(tx),
    tx,
  };
}

let calls: Calls;
beforeEach(() => {
  calls = { createData: [], updateManyArgs: [], auditData: [] };
});

describe('setGlobalFee', () => {
  it('inserts a NEW global FeeConfig row (operatorId null, never edits in place)', async () => {
    const prisma = fakePrisma(calls);
    const at = new Date('2026-06-02T00:00:00Z');

    const res = await setGlobalFee(prisma, {
      ratePpm: 70000,
      actor: 'admin:super-1',
      effectiveFrom: at,
    });

    expect(res).toEqual({ feeConfigId: 'fc_global_new' });
    expect(prisma.tx.feeConfig.create).toHaveBeenCalledTimes(1);
    expect(calls.createData[0]).toMatchObject({
      operatorId: null,
      ratePpm: 70000,
      effectiveFrom: at,
      createdBy: 'admin:super-1',
    });

    // The close sets effectiveTo only — never touches ratePpm.
    const updateArg = calls.updateManyArgs[0] as { where: unknown; data: Record<string, unknown> };
    expect(updateArg.data).toEqual({ effectiveTo: at });
    expect(updateArg.data).not.toHaveProperty('ratePpm');
  });

  it('closes ONLY the prior open GLOBAL row (operatorId null), never overrides', async () => {
    const prisma = fakePrisma(calls);
    const at = new Date('2026-06-02T00:00:00Z');

    await setGlobalFee(prisma, { ratePpm: 50000, actor: 'admin:super-1', effectiveFrom: at });

    expect(prisma.tx.feeConfig.updateMany).toHaveBeenCalledWith({
      where: { operatorId: null, effectiveTo: null },
      data: { effectiveTo: at },
    });
  });

  it('writes a global-fee-change audit row in the same transaction', async () => {
    const prisma = fakePrisma(calls);

    await setGlobalFee(prisma, { ratePpm: 30000, actor: 'admin:fin-1' });

    expect(prisma.tx.adminAuditLog.create).toHaveBeenCalledTimes(1);
    expect(calls.auditData[0]).toMatchObject({
      actor: 'admin:fin-1',
      action: 'global-fee-change',
      target: 'GLOBAL',
    });
    const audit = calls.auditData[0] as { argsRedacted: string };
    expect(JSON.parse(audit.argsRedacted)).toMatchObject({ ratePpm: 30000 });
  });

  it('rejects a non-integer / negative / out-of-range ratePpm before any write', async () => {
    const prisma = fakePrisma(calls);
    await expect(
      setGlobalFee(prisma, { ratePpm: 1234.5, actor: 'a' })
    ).rejects.toBeInstanceOf(GlobalFeeError);
    await expect(setGlobalFee(prisma, { ratePpm: -1, actor: 'a' })).rejects.toBeInstanceOf(
      GlobalFeeError
    );
    await expect(
      setGlobalFee(prisma, { ratePpm: MAX_GLOBAL_FEE_PPM + 1, actor: 'a' })
    ).rejects.toBeInstanceOf(GlobalFeeError);
    expect(prisma.tx.feeConfig.create).not.toHaveBeenCalled();
  });
});
