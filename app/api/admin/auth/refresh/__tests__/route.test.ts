/**
 * Unit tests for POST /api/admin/auth/refresh.
 * Covers the #589 sentinels (expired / benign race) plus reuse + happy path. The admin
 * contract keeps tokens OUT of the response body — success and race both echo { role }.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCookiesGet,
  mockCookiesSet,
  mockVerifyAdminRefreshToken,
  mockRotateAdminRefresh,
  mockVerifyAdminAccess,
} = vi.hoisted(() => ({
  mockCookiesGet: vi.fn(),
  mockCookiesSet: vi.fn(),
  mockVerifyAdminRefreshToken: vi.fn(),
  mockRotateAdminRefresh: vi.fn(),
  mockVerifyAdminAccess: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookiesGet, set: mockCookiesSet }),
}));

vi.mock('@/lib/auth', () => ({
  verifyAdminRefreshToken: mockVerifyAdminRefreshToken,
  rotateAdminRefresh: mockRotateAdminRefresh,
  verifyAdminAccess: mockVerifyAdminAccess,
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/auth/refresh', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdminAccess.mockResolvedValue({ role: 'FINANCE' });
});

describe('POST /api/admin/auth/refresh', () => {
  it('returns 401 NO_SESSION when cookie absent', async () => {
    mockCookiesGet.mockReturnValue(undefined);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('NO_SESSION');
  });

  it('returns 401 SESSION_REUSE and clears cookies on reuse', async () => {
    mockCookiesGet.mockReturnValue({ value: 'reused' });
    mockVerifyAdminRefreshToken.mockReturnValue({ payload: { adminUserId: 'a1' }, hash: 'h1' });
    mockRotateAdminRefresh.mockResolvedValue({ reuse: true });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('SESSION_REUSE');
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_admin_access', '', expect.objectContaining({ maxAge: 0 }));
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_admin_refresh', '', expect.objectContaining({ maxAge: 0 }));
  });

  it('#589: returns 401 INVALID_SESSION and clears cookies on an expired session', async () => {
    mockCookiesGet.mockReturnValue({ value: 'expired' });
    mockVerifyAdminRefreshToken.mockReturnValue({ payload: { adminUserId: 'a1' }, hash: 'h1' });
    mockRotateAdminRefresh.mockResolvedValue({ expired: true });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('INVALID_SESSION');
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_admin_refresh', '', expect.objectContaining({ maxAge: 0 }));
  });

  it('#589: benign race sets ONLY the access cookie (refresh untouched) and echoes { role }', async () => {
    mockCookiesGet.mockReturnValue({ value: 'raced' });
    mockVerifyAdminRefreshToken.mockReturnValue({ payload: { adminUserId: 'a1' }, hash: 'h1' });
    mockRotateAdminRefresh.mockResolvedValue({ raced: true, accessToken: 'fresh-admin-access' });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.role).toBe('FINANCE');
    // No token in the body (admin contract).
    expect(json.accessToken).toBeUndefined();
    expect(mockCookiesSet).toHaveBeenCalledWith(
      'bb_admin_access',
      'fresh-admin-access',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict', maxAge: 10 * 60 })
    );
    // Refresh cookie must NOT be rotated on a race.
    const refreshSet = mockCookiesSet.mock.calls.find((c: unknown[]) => c[0] === 'bb_admin_refresh');
    expect(refreshSet).toBeUndefined();
  });

  it('returns 200 { role } and rotates both cookies on success', async () => {
    mockCookiesGet.mockReturnValue({ value: 'valid' });
    mockVerifyAdminRefreshToken.mockReturnValue({ payload: { adminUserId: 'a1' }, hash: 'h1' });
    mockRotateAdminRefresh.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      refreshHash: 'new-hash',
    });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.role).toBe('FINANCE');
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_admin_access', 'new-access', expect.objectContaining({ maxAge: 10 * 60 }));
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_admin_refresh', 'new-refresh', expect.objectContaining({ maxAge: 30 * 24 * 60 * 60 }));
  });
});
