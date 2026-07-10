/**
 * Issue 090: unit tests for the retention sweeper core.
 *
 * The DB client, the storage layer (deleteObject), and the retention-policy
 * constants are mocked. The lock `tx` (the JobCore's first arg) is a stub:
 *   - $executeRaw returns the guest-scrub affected-row count,
 *   - $queryRaw returns the staged KYB candidate rows,
 *   - kybDocument.update records the purgedAt stamp.
 *
 * We assert the sweeper:
 *   - issues a single bulk guest-scrub UPDATE and counts its affected rows,
 *   - claims expired KYB docs and for each calls deleteObject + stamps purgedAt,
 *   - returns rowsAffected = guest-scrubbed + docs-purged,
 *   - is a no-op (0/0) when nothing is past the window.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- hoisted mocks ----
const { mockPrisma, mockDeleteObject } = vi.hoisted(() => ({
  mockPrisma: {},
  mockDeleteObject: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/storage', () => ({ deleteObject: mockDeleteObject }));
vi.mock('@/lib/account/retentionPolicy', () => ({
  GUEST_PII_RETENTION_DAYS: 365,
  KYB_DOC_RETENTION_DAYS: 90,
}));
// Prisma.sql passthrough — the stub tx ignores the SQL and returns staged values
// by call order.
vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@prisma/client')>();
  return {
    ...actual,
    Prisma: { ...actual.Prisma, sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ strings, vals }) },
  };
});

import { retentionSweeper } from '../retentionSweeper';

/**
 * Build a lock-tx stub.
 * @param guestCount  the affected-row count $executeRaw (guest scrub) resolves to
 * @param kybRows     the KYB candidate rows $queryRaw resolves to
 */
function makeTx(guestCount: number, kybRows: unknown[]) {
  const kybUpdate = vi.fn().mockResolvedValue({});
  return {
    tx: {
      $executeRaw: vi.fn().mockResolvedValue(guestCount),
      $queryRaw: vi.fn().mockResolvedValue(kybRows),
      kybDocument: { update: kybUpdate },
    } as never,
    kybUpdate,
  };
}

const NOW = new Date('2026-06-03T03:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteObject.mockResolvedValue(undefined);
});

describe('retentionSweeper', () => {
  it('runs the bulk guest-scrub UPDATE and counts its affected rows', async () => {
    const { tx } = makeTx(4, []);
    const res = await retentionSweeper(tx, { now: NOW });

    expect((tx as unknown as { $executeRaw: ReturnType<typeof vi.fn> }).$executeRaw)
      .toHaveBeenCalledTimes(1);
    // No KYB candidates → only the guest scrub counts.
    expect(res).toEqual({ rowsAffected: 4, status: 'success' });
  });

  it('purges each expired KYB doc: deleteObject + stamps purgedAt', async () => {
    const kybRows = [
      { id: 'kyb_1', storageKey: 'kyb_doc/aaa/license.pdf' },
      { id: 'kyb_2', storageKey: 'kyb_doc/bbb/identity.pdf' },
    ];
    const { tx, kybUpdate } = makeTx(0, kybRows);

    const res = await retentionSweeper(tx, { now: NOW });

    // deleteObject called once per doc with the app prisma singleton + storageKey.
    expect(mockDeleteObject).toHaveBeenCalledTimes(2);
    expect(mockDeleteObject).toHaveBeenNthCalledWith(1, mockPrisma, 'kyb_doc/aaa/license.pdf');
    expect(mockDeleteObject).toHaveBeenNthCalledWith(2, mockPrisma, 'kyb_doc/bbb/identity.pdf');

    // purgedAt stamped on each row with the injected `now`.
    expect(kybUpdate).toHaveBeenCalledTimes(2);
    expect(kybUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'kyb_1' },
      data: { purgedAt: NOW },
    });
    expect(kybUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'kyb_2' },
      data: { purgedAt: NOW },
    });

    expect(res).toEqual({ rowsAffected: 2, status: 'success' });
  });

  it('sums guest scrubs + KYB purges into rowsAffected', async () => {
    const { tx } = makeTx(3, [{ id: 'kyb_x', storageKey: 'kyb_doc/x/y.pdf' }]);
    const res = await retentionSweeper(tx, { now: NOW });
    expect(res.rowsAffected).toBe(4); // 3 guest + 1 kyb
  });

  it('is a no-op (0/0) when nothing is past the window', async () => {
    const { tx, kybUpdate } = makeTx(0, []);
    const res = await retentionSweeper(tx, { now: NOW });
    expect(mockDeleteObject).not.toHaveBeenCalled();
    expect(kybUpdate).not.toHaveBeenCalled();
    expect(res).toEqual({ rowsAffected: 0, status: 'success' });
  });

  it('does NOT stamp purgedAt when deleteObject throws (loud failure, bytes-first)', async () => {
    const { tx, kybUpdate } = makeTx(0, [{ id: 'kyb_z', storageKey: 'kyb_doc/z/z.pdf' }]);
    mockDeleteObject.mockRejectedValueOnce(new Error('s3_delete_failed'));
    await expect(retentionSweeper(tx, { now: NOW })).rejects.toThrow('s3_delete_failed');
    // purgedAt must NOT be stamped if the object delete failed.
    expect(kybUpdate).not.toHaveBeenCalled();
  });
});
