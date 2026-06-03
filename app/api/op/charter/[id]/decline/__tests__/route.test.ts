/**
 * Issue 083: unit tests for POST /api/op/charter/[id]/decline.
 *
 * Covers:
 *  - 401 without an operator session
 *  - 403 NOT_APPROVED when the operator is not APPROVED
 *  - 404 cross-operator (assigned to a different operator)
 *  - 200 happy path → declineCharter (ASSIGNED_DIRECT → DECLINED → ADMIN_REVIEW)
 *    with operator actor + optional reason; response { ok, to: 'ADMIN_REVIEW' }
 *  - 422 ILLEGAL_TRANSITION when not in ASSIGNED_DIRECT
 *
 * declineCharter is unit-tested at the lib layer for the DECLINED→assignee-clear
 * behavior; here we assert the route wiring (gate, ownership, actor, mapping).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorUserFindUnique,
  mockOperatorFindUnique,
  mockCharterFindUnique,
  mockCookieStore,
  mockDecline,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorUserFindUnique: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockCharterFindUnique: vi.fn(),
  mockCookieStore: { get: vi.fn() },
  mockDecline: vi.fn(),
}));

vi.mock('@/lib/auth/jwt', () => ({ verifyOperatorAccess: mockVerifyOperatorAccess }));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    operatorUser: { findUnique: mockOperatorUserFindUnique },
    operator: { findUnique: mockOperatorFindUnique },
    charterRequest: { findUnique: mockCharterFindUnique },
  },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('@/lib/charter/declineCharter', () => ({ declineCharter: mockDecline }));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { CharterError } from '@/lib/charter/errors';

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

function makePost(body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/op/charter/${CHARTER_ID}/decline`, {
    method: 'POST',
    headers: { Cookie: 'bb_op_access=valid-token', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const routeCtx = { params: Promise.resolve({ id: CHARTER_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({ sub: 'op-user-1', role: 'admin' });
  mockOperatorUserFindUnique.mockResolvedValue(OPERATOR_USER);
  mockOperatorFindUnique.mockResolvedValue({ status: 'APPROVED' });
  mockCharterFindUnique.mockResolvedValue({ assigneeOperatorId: OPERATOR_ID });
  mockDecline.mockResolvedValue({ ok: true, charterId: CHARTER_ID, to: 'ADMIN_REVIEW' });
});

describe('POST /api/op/charter/[id]/decline', () => {
  it('401 without an operator session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(401);
  });

  it('403 NOT_APPROVED when operator is not APPROVED', async () => {
    mockOperatorFindUnique.mockResolvedValue({ status: 'SUSPENDED' });
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('NOT_APPROVED');
    expect(mockDecline).not.toHaveBeenCalled();
  });

  it('404 when charter is assigned to a different operator', async () => {
    mockCharterFindUnique.mockResolvedValue({ assigneeOperatorId: 'op-org-B' });
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(404);
    expect(mockDecline).not.toHaveBeenCalled();
  });

  it('200 happy path → declines (→ADMIN_REVIEW) with operator actor + reason', async () => {
    const res = await POST(makePost({ reason: 'không đủ xe' }), routeCtx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, to: 'ADMIN_REVIEW' });
    expect(mockDecline).toHaveBeenCalledWith(expect.anything(), {
      charterId: CHARTER_ID,
      actor: `operator:${OPERATOR_ID}`,
      reason: 'không đủ xe',
    });
  });

  it('200 with no body (reason omitted)', async () => {
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(200);
    expect(mockDecline).toHaveBeenCalledWith(expect.anything(), {
      charterId: CHARTER_ID,
      actor: `operator:${OPERATOR_ID}`,
      reason: undefined,
    });
  });

  it('422 ILLEGAL_TRANSITION when not in ASSIGNED_DIRECT', async () => {
    mockDecline.mockRejectedValueOnce(new CharterError('illegal_transition'));
    const res = await POST(makePost(), routeCtx);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('ILLEGAL_TRANSITION');
  });
});
