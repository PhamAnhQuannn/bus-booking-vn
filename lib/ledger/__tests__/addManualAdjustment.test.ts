/**
 * Issue 068: unit tests for addManualAdjustment.
 *
 * Proves:
 *   - a single `adjustment` ledger entry is appended with the SIGNED amount as a
 *     BigInt (Issue 016) and a UNIQUE sourceEventId per call (two calls → two
 *     distinct `adjustment:<uuid>` keys, never colliding);
 *   - an audit row (action: 'ledger-adjustment') with { amountMinor, reason } is
 *     written in the SAME transaction;
 *   - a missing/empty reason is rejected before any write;
 *   - a zero / non-integer amount is rejected before any write.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));

const { mockAppend } = vi.hoisted(() => ({ mockAppend: vi.fn() }));
vi.mock('../ledgerRepo', () => ({ appendLedgerEntry: mockAppend }));

import { addManualAdjustment, ManualAdjustmentError } from '../addManualAdjustment';

interface Calls {
  auditData: unknown[];
}

function fakePrisma(calls: Calls) {
  const tx = {
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
  calls = { auditData: [] };
  mockAppend.mockReset();
  mockAppend.mockResolvedValue({ id: 'le_1', created: true });
});

describe('addManualAdjustment', () => {
  it('appends a signed BigInt adjustment with a unique sourceEventId and returns its id', async () => {
    const prisma = fakePrisma(calls);

    const res = await addManualAdjustment(prisma, {
      operatorId: 'op_1',
      amountMinor: -50000,
      reason: 'correction',
      actor: 'admin:fin-1',
    });

    expect(res).toEqual({ ledgerEntryId: 'le_1' });
    expect(mockAppend).toHaveBeenCalledTimes(1);
    const [entry] = mockAppend.mock.calls[0];
    expect(entry).toMatchObject({
      operatorId: 'op_1',
      type: 'adjustment',
      amountMinor: BigInt(-50000),
      currency: 'VND',
    });
    expect(entry.sourceEventId).toMatch(/^adjustment:/);
  });

  it('mints a DISTINCT sourceEventId per call (no collision across two adjustments)', async () => {
    const prisma = fakePrisma(calls);

    await addManualAdjustment(prisma, {
      operatorId: 'op_1',
      amountMinor: 1000,
      reason: 'r',
      actor: 'a',
    });
    await addManualAdjustment(prisma, {
      operatorId: 'op_1',
      amountMinor: 1000,
      reason: 'r',
      actor: 'a',
    });

    const key1 = mockAppend.mock.calls[0][0].sourceEventId;
    const key2 = mockAppend.mock.calls[1][0].sourceEventId;
    expect(key1).not.toEqual(key2);
  });

  it('writes a ledger-adjustment audit row with { amountMinor, reason } in the same tx', async () => {
    const prisma = fakePrisma(calls);

    await addManualAdjustment(prisma, {
      operatorId: 'op_1',
      amountMinor: 25000,
      reason: 'goodwill credit',
      actor: 'admin:super-1',
    });

    expect(prisma.tx.adminAuditLog.create).toHaveBeenCalledTimes(1);
    expect(calls.auditData[0]).toMatchObject({
      actor: 'admin:super-1',
      action: 'ledger-adjustment',
      target: 'op_1',
    });
    const audit = calls.auditData[0] as { argsRedacted: string };
    expect(JSON.parse(audit.argsRedacted)).toEqual({ amountMinor: 25000, reason: 'goodwill credit' });
  });

  it('rejects an empty reason before any write', async () => {
    const prisma = fakePrisma(calls);
    await expect(
      addManualAdjustment(prisma, { operatorId: 'op_1', amountMinor: 1000, reason: '   ', actor: 'a' })
    ).rejects.toBeInstanceOf(ManualAdjustmentError);
    expect(mockAppend).not.toHaveBeenCalled();
  });

  it('rejects a zero / non-integer amount before any write', async () => {
    const prisma = fakePrisma(calls);
    await expect(
      addManualAdjustment(prisma, { operatorId: 'op_1', amountMinor: 0, reason: 'r', actor: 'a' })
    ).rejects.toBeInstanceOf(ManualAdjustmentError);
    await expect(
      addManualAdjustment(prisma, { operatorId: 'op_1', amountMinor: 1.5, reason: 'r', actor: 'a' })
    ).rejects.toBeInstanceOf(ManualAdjustmentError);
    expect(mockAppend).not.toHaveBeenCalled();
  });
});
