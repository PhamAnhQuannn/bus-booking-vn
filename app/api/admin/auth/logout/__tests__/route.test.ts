/**
 * Unit tests for POST /api/admin/auth/logout.
 * Focus: idempotent revoke + cookie clear, and #584 bb_csrf rotation on the auth-state change.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCookiesGet, mockCookiesSet, mockVerifyAdminRefreshToken, mockRevokeAdminSession } =
  vi.hoisted(() => ({
    mockCookiesGet: vi.fn(),
    mockCookiesSet: vi.fn(),
    mockVerifyAdminRefreshToken: vi.fn(),
    mockRevokeAdminSession: vi.fn(),
  }));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookiesGet,
    set: mockCookiesSet,
  }),
}));

vi.mock('@/lib/auth/adminSession', () => ({
  verifyAdminRefreshToken: mockVerifyAdminRefreshToken,
  revokeAdminSession: mockRevokeAdminSession,
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/auth/logout', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRevokeAdminSession.mockResolvedValue(undefined);
});

describe('POST /api/admin/auth/logout', () => {
  it('returns 200 and clears both admin cookies even with no refresh cookie', async () => {
    mockCookiesGet.mockReturnValue(undefined);
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockRevokeAdminSession).not.toHaveBeenCalled();
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_admin_access', '', expect.objectContaining({ maxAge: 0 }));
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_admin_refresh', '', expect.objectContaining({ maxAge: 0 }));
  });

  it('revokes the session on a valid token', async () => {
    mockCookiesGet.mockReturnValue({ value: 'valid-token' });
    mockVerifyAdminRefreshToken.mockReturnValue({ payload: { adminUserId: 'a1' }, hash: 'hash1' });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockRevokeAdminSession).toHaveBeenCalledWith('hash1');
  });

  it('#584: rotates the bb_csrf double-submit token on logout', async () => {
    mockCookiesGet.mockReturnValue(undefined);
    await POST(makeRequest());
    const csrf = mockCookiesSet.mock.calls.find((c: unknown[]) => c[0] === 'bb_csrf');
    expect(csrf, 'bb_csrf must be rotated on admin logout').toBeDefined();
    expect((csrf![1] as string).length).toBeGreaterThan(0);
    expect(csrf![2]).toMatchObject({ httpOnly: false, sameSite: 'lax', path: '/' });
  });
});
