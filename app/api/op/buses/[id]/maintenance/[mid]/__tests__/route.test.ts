/**
 * Unit tests for DELETE /api/op/buses/[id]/maintenance/[mid] — Issue 011.
 *
 * Coverage:
 *   AC6 cross-op bus → 404.
 *   Cross-bus maintenance (mid not on this bus) → 404.
 *   Happy path → 200 { ok: true }.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockBusFindFirst,
  mockBusMaintFindFirst,
  mockBusMaintDelete,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockBusFindFirst: vi.fn(),
  mockBusMaintFindFirst: vi.fn(),
  mockBusMaintDelete: vi.fn(),
  mockCookieStore: { get: vi.fn() },
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    operatorUser: { findUnique: mockOperatorFindUnique },
    bus: { findFirst: mockBusFindFirst },
    busMaintenance: { findFirst: mockBusMaintFindFirst, delete: mockBusMaintDelete },
  },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { DELETE } from '../route';
import { NextRequest } from 'next/server';

const OPERATOR_USER = {
  id: 'op-1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: 'op-org-1',
};

function makeDelete(id: string, mid: string) {
  return {
    req: new NextRequest(`http://localhost/api/op/buses/${id}/maintenance/${mid}`, {
      method: 'DELETE',
      headers: { Cookie: 'bb_op_access=valid-token' },
    }),
    ctx: { params: Promise.resolve({ id, mid }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({
    sub: 'op-1',
    scope: 'operator',
    requiresPasswordChange: false,
    operatorId: 'op-org-1',
  });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_USER);
});

describe('DELETE /api/op/buses/[id]/maintenance/[mid]', () => {
  it('AC6: returns 404 when bus is cross-op', async () => {
    mockBusFindFirst.mockResolvedValueOnce(null);
    const { req, ctx } = makeDelete('b-other-op', 'm1');
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
    expect(mockBusMaintDelete).not.toHaveBeenCalled();
  });

  it('returns 404 when maintenance does not belong to bus', async () => {
    mockBusFindFirst.mockResolvedValueOnce({ id: 'b1' });
    mockBusMaintFindFirst.mockResolvedValueOnce(null);
    const { req, ctx } = makeDelete('b1', 'm-other-bus');
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
    expect(mockBusMaintDelete).not.toHaveBeenCalled();
  });

  it('happy path: returns 200 { ok: true }', async () => {
    mockBusFindFirst.mockResolvedValueOnce({ id: 'b1' });
    mockBusMaintFindFirst.mockResolvedValueOnce({ id: 'm1' });
    mockBusMaintDelete.mockResolvedValue({ id: 'm1' });
    const { req, ctx } = makeDelete('b1', 'm1');
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(mockBusMaintDelete).toHaveBeenCalledWith({ where: { id: 'm1' } });
  });
});
