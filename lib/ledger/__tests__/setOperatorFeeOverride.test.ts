/**
 * Issue 067: unit tests for setOperatorFeeOverride.
 *
 * Proves the effective-dated, never-edit-in-place contract (AGENTS.md Issue 013):
 *   - a NEW FeeConfig row is created (feeConfig.create), NOT an update of an
 *     existing row's ratePpm (no feeConfig.update of ratePpm anywhere);
 *   - the prior open override is closed via updateMany (effectiveTo only);
 *   - an audit row is written in the SAME transaction;
 *   - an out-of-range / non-integer ratePpm is rejected before any write.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// The service imports the shared prisma client at module load; it takes an
// injectable client so the default is never exercised — stub to an empty object.
vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));

import {
  setOperatorFeeOverride,
  FeeOverrideError,
  MAX_FEE_OVERRIDE_PPM,
} from '../setOperatorFeeOverride';

interface Calls {
  createData: unknown[];
  updateManyArgs: unknown[];
  auditData: unknown[];
}

/**
 * Build a fake prisma whose $transaction runs the callback with a tx exposing
 * feeConfig.create / feeConfig.updateMany / adminAuditLog.create, recording calls.
 */
function fakePrisma(calls: Calls) {
  const tx = {
    feeConfig: {
      create: vi.fn(async (args: { data: unknown }) => {
        calls.createData.push(args.data);
        return { id: 'fc_new' };
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

describe('setOperatorFeeOverride', () => {
  it('inserts a NEW FeeConfig row (never edits in place) and returns its id', async () => {
    const prisma = fakePrisma(calls);
    const at = new Date('2026-06-02T00:00:00Z');

    const res = await setOperatorFeeOverride(prisma, {
      operatorId: 'op_1',
      ratePpm: 40000,
      actor: 'admin:super-1',
      effectiveFrom: at,
    });

    expect(res).toEqual({ feeConfigId: 'fc_new' });

    // A new row was CREATED with the override fields.
    expect(prisma.tx.feeConfig.create).toHaveBeenCalledTimes(1);
    expect(calls.createData[0]).toMatchObject({
      operatorId: 'op_1',
      ratePpm: 40000,
      effectiveFrom: at,
      createdBy: 'admin:super-1',
    });

    // No update of an existing row's ratePpm — only the create + the close
    // (updateMany sets effectiveTo only, never touches ratePpm).
    const updateArg = calls.updateManyArgs[0] as { where: unknown; data: Record<string, unknown> };
    expect(updateArg.data).toEqual({ effectiveTo: at });
    expect(updateArg.data).not.toHaveProperty('ratePpm');
  });

  it('closes the prior open override (effectiveTo = effectiveFrom)', async () => {
    const prisma = fakePrisma(calls);
    const at = new Date('2026-06-02T00:00:00Z');

    await setOperatorFeeOverride(prisma, {
      operatorId: 'op_1',
      ratePpm: 50000,
      actor: 'admin:super-1',
      effectiveFrom: at,
    });

    expect(prisma.tx.feeConfig.updateMany).toHaveBeenCalledWith({
      where: { operatorId: 'op_1', effectiveTo: null },
      data: { effectiveTo: at },
    });
  });

  it('writes an audit row in the same transaction', async () => {
    const prisma = fakePrisma(calls);

    await setOperatorFeeOverride(prisma, {
      operatorId: 'op_1',
      ratePpm: 30000,
      actor: 'admin:fin-1',
    });

    expect(prisma.tx.adminAuditLog.create).toHaveBeenCalledTimes(1);
    expect(calls.auditData[0]).toMatchObject({
      actor: 'admin:fin-1',
      action: 'operator-fee-override',
      target: 'op_1',
    });
    const audit = calls.auditData[0] as { argsRedacted: string };
    expect(JSON.parse(audit.argsRedacted)).toMatchObject({ ratePpm: 30000 });
  });

  it('rejects a non-integer ratePpm before any write', async () => {
    const prisma = fakePrisma(calls);
    await expect(
      setOperatorFeeOverride(prisma, { operatorId: 'op_1', ratePpm: 1234.5, actor: 'a' })
    ).rejects.toBeInstanceOf(FeeOverrideError);
    expect(prisma.tx.feeConfig.create).not.toHaveBeenCalled();
  });

  it('rejects a negative ratePpm', async () => {
    const prisma = fakePrisma(calls);
    await expect(
      setOperatorFeeOverride(prisma, { operatorId: 'op_1', ratePpm: -1, actor: 'a' })
    ).rejects.toBeInstanceOf(FeeOverrideError);
  });

  it('rejects a ratePpm above the max (20%)', async () => {
    const prisma = fakePrisma(calls);
    await expect(
      setOperatorFeeOverride(prisma, {
        operatorId: 'op_1',
        ratePpm: MAX_FEE_OVERRIDE_PPM + 1,
        actor: 'a',
      })
    ).rejects.toBeInstanceOf(FeeOverrideError);
  });
});
