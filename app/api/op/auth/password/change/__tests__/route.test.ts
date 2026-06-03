/**
 * Unit tests for POST /api/op/auth/password/change
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockVerifyPassword,
  mockHashPassword,
  mockOperatorFindUnique,
  mockOperatorUpdate,
  mockOperatorSessionFindUnique,
  mockRevokeAll,
  mockIssueSession,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockVerifyPassword: vi.fn(),
  mockHashPassword: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockOperatorUpdate: vi.fn(),
  mockOperatorSessionFindUnique: vi.fn(),
  mockRevokeAll: vi.fn(),
  mockIssueSession: vi.fn(),
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('@/lib/auth/jwt', () => ({ verifyOperatorAccess: mockVerifyOperatorAccess }));
vi.mock('@/lib/auth/password', () => ({
  verify: mockVerifyPassword,
  hash: mockHashPassword,
}));
vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    operatorUser: {
      findUnique: mockOperatorFindUnique,
      update: mockOperatorUpdate,
    },
    operatorSession: {
      findUnique: mockOperatorSessionFindUnique,
    },
  },
}));
vi.mock('@/lib/auth/operatorSession', () => ({
  revokeAllOperatorSessions: mockRevokeAll,
  issueOperatorSession: mockIssueSession,
  verifyOpRefreshToken: vi.fn(() => null),
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown, cookie = 'valid-access-token'): NextRequest {
  return new NextRequest('http://localhost/api/op/auth/password/change', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `bb_op_access=${cookie}`,
    },
    body: JSON.stringify(body),
  });
}

const OPERATOR = { id: 'op-1', passwordHash: 'stored-hash', disabledAt: null, operatorId: 'op-org-1' };

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockImplementation((name: string) => {
    if (name === 'bb_op_access') return { value: 'valid-access-token' };
    return undefined;
  });
  mockVerifyOperatorAccess.mockResolvedValue({ sub: 'op-1', scope: 'operator', requiresPasswordChange: false, operatorId: 'op-org-1' });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR);
  mockVerifyPassword.mockResolvedValue(true); // currentPassword matches
  mockHashPassword.mockResolvedValue('new-hash');
  mockRevokeAll.mockResolvedValue(undefined);
  mockIssueSession.mockResolvedValue({
    accessToken: 'new-access',
    refreshToken: 'new-refresh',
    refreshHash: 'new-hash-rt',
    family: 'fam-1',
  });
  mockOperatorUpdate.mockResolvedValue({});
});

describe('POST /api/op/auth/password/change', () => {
  it('returns 204 on successful password change', async () => {
    // First call: current password valid, second call: not same as old
    mockVerifyPassword.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const res = await POST(makeRequest({ currentPassword: 'OldPass1', newPassword: 'NewPass2' }));
    expect(res.status).toBe(204);
  });

  it('returns 401 when no access cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makeRequest({ currentPassword: 'OldPass1', newPassword: 'NewPass2' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 WRONG_CURRENT when currentPassword does not match', async () => {
    mockVerifyPassword.mockResolvedValue(false);
    const res = await POST(makeRequest({ currentPassword: 'wrong', newPassword: 'NewPass2' }));
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('WRONG_CURRENT');
  });

  it('returns 409 SAME_AS_OLD when newPassword equals currentPassword', async () => {
    // Both verifyPassword calls return true → same as old
    mockVerifyPassword.mockResolvedValue(true);
    const res = await POST(makeRequest({ currentPassword: 'SamePass1', newPassword: 'SamePass1' }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBe('SAME_AS_OLD');
  });

  it('returns 400 WEAK_PASSWORD when newPassword too short', async () => {
    mockVerifyPassword.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const res = await POST(makeRequest({ currentPassword: 'OldPass1', newPassword: 'short' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('WEAK_PASSWORD');
  });

  it('issues fresh cookies on success', async () => {
    mockVerifyPassword.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await POST(makeRequest({ currentPassword: 'OldPass1', newPassword: 'NewPass2' }));
    const calls = mockCookieStore.set.mock.calls.map((c: string[]) => c[0]);
    expect(calls).toContain('bb_op_access');
    expect(calls).toContain('bb_op_refresh');
  });
});
