/**
 * Unit tests for bulkReorder (Issue 012).
 *
 * bulkReorder uses $transaction (callback form) + raw SELECT FOR UPDATE.
 * We mock prisma.$transaction to pass a tx mock with the required methods.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockTransaction,
  mockQueryRaw,
  mockPickupPointFindMany,
  mockPickupPointUpdate,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockPickupPointFindMany: vi.fn(),
  mockPickupPointUpdate: vi.fn(),
}));

// Build a fake tx object that the $transaction callback receives
function makeTx(lockRows: { id: string }[] = [{ id: 'r1' }], activePoints: { id: string }[] = []) {
  return {
    $queryRaw: mockQueryRaw.mockResolvedValue(lockRows),
    pickupPoint: {
      findMany: mockPickupPointFindMany.mockResolvedValue(activePoints),
      update: mockPickupPointUpdate.mockResolvedValue({}),
    },
  };
}

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}));

import { bulkReorder } from '../bulkReorder';
import { PickupPointServiceError } from '../createPickupPoint';

const PP_A = { id: 'pp-a' };
const PP_B = { id: 'pp-b' };
const PP_C = { id: 'pp-c' };

beforeEach(() => {
  vi.clearAllMocks();
  // Default: transaction resolves with whatever the callback returns
  mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = makeTx([{ id: 'r1' }], [PP_A, PP_B, PP_C]);
    return cb(tx);
  });
  // Final findMany for return value
  mockPickupPointFindMany
    .mockResolvedValueOnce([PP_A, PP_B, PP_C]) // active set
    .mockResolvedValueOnce([PP_A, PP_B, PP_C]); // return value
});

describe('bulkReorder', () => {
  it('updates each pickup point displayOrder to 1-indexed position', async () => {
    await bulkReorder({
      operatorId: 'op1',
      routeId: 'r1',
      orderedIds: ['pp-c', 'pp-a', 'pp-b'],
    });
    // pp-c → 1, pp-a → 2, pp-b → 3
    expect(mockPickupPointUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pp-c' }, data: { displayOrder: 1 } })
    );
    expect(mockPickupPointUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pp-a' }, data: { displayOrder: 2 } })
    );
    expect(mockPickupPointUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pp-b' }, data: { displayOrder: 3 } })
    );
  });

  it('throws not_found when route lock query returns empty', async () => {
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = makeTx([], [PP_A, PP_B]);
      return cb(tx);
    });
    await expect(
      bulkReorder({ operatorId: 'op1', routeId: 'r1', orderedIds: ['pp-a', 'pp-b'] })
    ).rejects.toSatisfy((e: PickupPointServiceError) => e.code === 'not_found');
  });

  it('throws unknown_pickup_points when orderedIds contains foreign id', async () => {
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = makeTx([{ id: 'r1' }], [PP_A, PP_B]);
      return cb(tx);
    });
    await expect(
      bulkReorder({ operatorId: 'op1', routeId: 'r1', orderedIds: ['pp-a', 'pp-b', 'pp-ALIEN'] })
    ).rejects.toSatisfy((e: PickupPointServiceError) => e.code === 'unknown_pickup_points');
  });

  it('throws incomplete_reorder when an active id is omitted from orderedIds', async () => {
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = makeTx([{ id: 'r1' }], [PP_A, PP_B, PP_C]);
      return cb(tx);
    });
    await expect(
      bulkReorder({ operatorId: 'op1', routeId: 'r1', orderedIds: ['pp-a', 'pp-b'] }) // missing pp-c
    ).rejects.toSatisfy((e: PickupPointServiceError) => e.code === 'incomplete_reorder');
  });

  it('uses $transaction (callback form, not array form)', async () => {
    await bulkReorder({
      operatorId: 'op1',
      routeId: 'r1',
      orderedIds: ['pp-a', 'pp-b', 'pp-c'],
    });
    // $transaction should be called with a function (callback form), not an array
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function));
  });
});
