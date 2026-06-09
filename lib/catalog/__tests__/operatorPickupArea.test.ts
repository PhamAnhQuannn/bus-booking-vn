/**
 * Unit tests for the operator pickup-area menu services (Issue 105).
 * Uses the real lib/geo loader (pure, vendored dataset) + a mocked Prisma client.
 * Codes: Phúc Xá (1) ∈ Ba Đình (1) ∈ Hà Nội (1).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindFirst, mockAggregate, mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockAggregate: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    operatorPickupArea: {
      findFirst: mockFindFirst,
      aggregate: mockAggregate,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}));

import { createOperatorPickupArea, PickupAreaServiceError } from '../createOperatorPickupArea';
import { deactivateOperatorPickupArea } from '../deactivateOperatorPickupArea';

beforeEach(() => {
  vi.clearAllMocks();
  mockFindFirst.mockResolvedValue(null);
  mockAggregate.mockResolvedValue({ _max: { displayOrder: 2 } });
  mockCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'area-1', isActive: true, ...data })
  );
  mockUpdate.mockResolvedValue({ id: 'area-1', isActive: false });
});

describe('createOperatorPickupArea', () => {
  it('resolves names + label from codes and creates with next displayOrder', async () => {
    await createOperatorPickupArea({
      operatorId: 'op1',
      data: { provinceCode: '1', districtCode: '1', wardCode: '1' },
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const arg = mockCreate.mock.calls[0][0].data;
    expect(arg.operatorId).toBe('op1');
    expect(arg.wardName).toBe('Phường Phúc Xá');
    expect(arg.districtName).toBe('Quận Ba Đình');
    expect(arg.label).toBe('Phường Phúc Xá, Quận Ba Đình, Thành phố Hà Nội');
    expect(arg.displayOrder).toBe(3); // max 2 + 1
  });

  it('rejects an inconsistent code triple with invalid_area', async () => {
    await expect(
      createOperatorPickupArea({
        operatorId: 'op1',
        data: { provinceCode: '1', districtCode: '1', wardCode: '999999' },
      })
    ).rejects.toMatchObject({ code: 'invalid_area' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects a duplicate active ward with duplicate_area', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'existing' });
    await expect(
      createOperatorPickupArea({
        operatorId: 'op1',
        data: { provinceCode: '1', districtCode: '1', wardCode: '1' },
      })
    ).rejects.toMatchObject({ code: 'duplicate_area' });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('deactivateOperatorPickupArea', () => {
  it('deactivates an active area', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'area-1', isActive: true });
    const res = await deactivateOperatorPickupArea({ operatorId: 'op1', areaId: 'area-1' });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'area-1', operatorId: 'op1' }, data: { isActive: false } })
    );
    expect(res.isActive).toBe(false);
  });

  it('throws not_found for a missing/cross-op area', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await expect(
      deactivateOperatorPickupArea({ operatorId: 'op1', areaId: 'nope' })
    ).rejects.toBeInstanceOf(PickupAreaServiceError);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('throws already_inactive for an inactive area', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'area-1', isActive: false });
    await expect(
      deactivateOperatorPickupArea({ operatorId: 'op1', areaId: 'area-1' })
    ).rejects.toMatchObject({ code: 'already_inactive' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
