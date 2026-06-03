/**
 * Issue 077: unit tests for POST /api/op/kyb/submit.
 *
 * Covers:
 *   - 401 without an operator session
 *   - 200 happy path → submitForReview called with operatorId (from JWT) + actor
 *   - 422 ILLEGAL_TRANSITION when the 045 service rejects (not PENDING_REVIEW)
 *   - 404 OPERATOR_NOT_FOUND on operator_not_found
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockCookieStore,
  mockSubmitForReview,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockCookieStore: { get: vi.fn() },
  mockSubmitForReview: vi.fn(),
}));

vi.mock('@/lib/auth/jwt', () => ({ verifyOperatorAccess: mockVerifyOperatorAccess }));
vi.mock('@/lib/db/client', () => ({
  prisma: { operatorUser: { findUnique: mockOperatorFindUnique } },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('@/lib/onboarding/kyb', async () => {
  const actual = await vi.importActual<typeof import('@/lib/onboarding/kyb')>(
    '@/lib/onboarding/kyb'
  );
  return { ...actual, submitForReview: mockSubmitForReview };
});

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { OperatorStatusError } from '@/lib/onboarding/errors';

const OPERATOR_USER = {
  id: 'op-user-1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  role: 'admin' as const,
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: 'op-org-A',
  assignedTripId: null,
};

function makePost(): NextRequest {
  return new NextRequest('http://localhost/api/op/kyb/submit', {
    method: 'POST',
    headers: { Cookie: 'bb_op_access=valid-token' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({
    sub: 'op-user-1',
    scope: 'operator',
    requiresPasswordChange: false,
    operatorId: 'op-org-A',
    role: 'admin',
  });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_USER);
  mockSubmitForReview.mockResolvedValue(undefined);
});

describe('POST /api/op/kyb/submit', () => {
  it('401 without an operator session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost());
    expect(res.status).toBe(401);
  });

  it('200 happy path → submitForReview called with operatorId (JWT) + actor', async () => {
    const res = await POST(makePost());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockSubmitForReview).toHaveBeenCalledWith({
      operatorId: 'op-org-A',
      actor: 'operator:op-org-A',
    });
  });

  it('422 ILLEGAL_TRANSITION when not in PENDING_REVIEW', async () => {
    mockSubmitForReview.mockRejectedValueOnce(new OperatorStatusError('illegal_transition'));
    const res = await POST(makePost());
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('ILLEGAL_TRANSITION');
  });

  it('404 OPERATOR_NOT_FOUND on operator_not_found', async () => {
    mockSubmitForReview.mockRejectedValueOnce(new OperatorStatusError('operator_not_found'));
    const res = await POST(makePost());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('OPERATOR_NOT_FOUND');
  });
});
