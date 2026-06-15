/**
 * Issue 083: unit tests for POST /api/op/charter/[id]/accept.
 *
 * Covers:
 *  - 401 without an operator session
 *  - 403 NOT_APPROVED when the operator is not APPROVED
 *  - 404 when the charter is assigned to a DIFFERENT operator (cross-op leak guard)
 *  - 404 when the charter does not exist
 *  - 200 happy path → transitionCharterRequest(..→ACCEPTED) with operator actor
 *  - 422 ILLEGAL_TRANSITION when not in ASSIGNED_DIRECT
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorUserFindUnique,
  mockOperatorFindUnique,
  mockCookieStore,
  mockTransition,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorUserFindUnique: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockCookieStore: { get: vi.fn() },
  mockTransition: vi.fn(),
}));

vi.mock('@/lib/auth/jwt', () => ({ verifyOperatorAccess: mockVerifyOperatorAccess }));
vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    operatorUser: { findUnique: mockOperatorUserFindUnique },
    operator: { findUnique: mockOperatorFindUnique },
  },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('@/lib/charter/charterStatus', () => ({ transitionCharterRequest: mockTransition }));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { CharterError } from '@/lib/charter';

const CHARTER_ID = 'ch_1';
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
  return new NextRequest(`http://localhost/api/op/charter/${CHARTER_ID}/accept`, {
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
  mockTransition.mockResolvedValue({ ok: true });
});

describe('POST /api/op/charter/[id]/accept', () => {
  it('401 without an operator session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(401);
  });

  it('403 NOT_APPROVED when operator is not APPROVED', async () => {
    mockOperatorFindUnique.mockResolvedValue({ status: 'UNDER_REVIEW' });
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('NOT_APPROVED');
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it('404 when charter is assigned to a different operator (ownership inside tx)', async () => {
    mockTransition.mockRejectedValueOnce(new CharterError('charter_not_found'));
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(404);
  });

  it('404 when charter does not exist', async () => {
    mockTransition.mockRejectedValueOnce(new CharterError('charter_not_found'));
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(404);
  });

  it('200 happy path → transitions to ACCEPTED with operator actor', async () => {
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockTransition).toHaveBeenCalledWith(expect.anything(), {
      charterId: CHARTER_ID,
      to: 'ACCEPTED',
      actor: `operator:${OPERATOR_ID}`,
      requiredAssigneeOperatorId: OPERATOR_ID,
    });
  });

  it('422 ILLEGAL_TRANSITION when not in ASSIGNED_DIRECT', async () => {
    mockTransition.mockRejectedValueOnce(new CharterError('illegal_transition', 'ACCEPTED -> ACCEPTED'));
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('ILLEGAL_TRANSITION');
  });

  it('404 when the transition reports charter_not_found', async () => {
    mockTransition.mockRejectedValueOnce(new CharterError('charter_not_found'));
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(404);
  });
});
