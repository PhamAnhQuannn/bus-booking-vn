/**
 * Issue 084: unit tests for POST /api/op/charter/[id]/claim.
 *
 * Covers:
 *  - 401 without an operator session
 *  - 403 NOT_APPROVED when the operator is not APPROVED (claim NOT attempted)
 *  - 200 win  → claimCharter returns { ok:true }
 *  - 409 already_claimed → claimCharter returns { ok:false, reason:'already_claimed' }
 *    (the racing-loser status, per AC)
 *  - 404 not_found → claimCharter returns { ok:false, reason:'not_found' }
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorUserFindUnique,
  mockOperatorFindUnique,
  mockCookieStore,
  mockClaim,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorUserFindUnique: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockCookieStore: { get: vi.fn() },
  mockClaim: vi.fn(),
}));

vi.mock('@/lib/auth/jwt', () => ({ verifyOperatorAccess: mockVerifyOperatorAccess }));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    operatorUser: { findUnique: mockOperatorUserFindUnique },
    operator: { findUnique: mockOperatorFindUnique },
  },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('@/lib/charter/claimCharter', () => ({ claimCharter: mockClaim }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

const CHARTER_ID = 'ch_pool_1';
const OPERATOR_ID = 'op-org-A';

const OPERATOR_USER = {
  id: 'op-user-1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  role: 'admin' as const,
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: OPERATOR_ID,
  assignedTripId: null,
};

function makePost(): NextRequest {
  return new NextRequest(`http://localhost/api/op/charter/${CHARTER_ID}/claim`, {
    method: 'POST',
    headers: { Cookie: 'bb_op_access=valid-token' },
  });
}

const routeCtx = { params: Promise.resolve({ id: CHARTER_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({ sub: 'op-user-1', role: 'admin' });
  mockOperatorUserFindUnique.mockResolvedValue(OPERATOR_USER);
  mockOperatorFindUnique.mockResolvedValue({ status: 'APPROVED' });
  mockClaim.mockResolvedValue({ ok: true });
});

describe('POST /api/op/charter/[id]/claim', () => {
  it('401 without an operator session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(401);
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('403 NOT_APPROVED when operator is not APPROVED (no claim attempted)', async () => {
    mockOperatorFindUnique.mockResolvedValue({ status: 'UNDER_REVIEW' });
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('NOT_APPROVED');
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('200 win → claimCharter called with charterId + operatorId', async () => {
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockClaim).toHaveBeenCalledWith(expect.anything(), {
      charterId: CHARTER_ID,
      operatorId: OPERATOR_ID,
    });
  });

  it('409 already_claimed when another operator claimed first', async () => {
    mockClaim.mockResolvedValue({ ok: false, reason: 'already_claimed' });
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('already_claimed');
  });

  it('404 not_found when the charter does not exist', async () => {
    mockClaim.mockResolvedValue({ ok: false, reason: 'not_found' });
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });
});
