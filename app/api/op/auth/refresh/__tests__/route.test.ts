/**
 * Unit tests for POST /api/op/auth/refresh
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCookiesGet, mockCookiesSet, mockVerifyOpRefreshToken, mockRotateOperatorRefresh, mockOperatorFindUnique } =
  vi.hoisted(() => ({
    mockCookiesGet: vi.fn(),
    mockCookiesSet: vi.fn(),
    mockVerifyOpRefreshToken: vi.fn(),
    mockRotateOperatorRefresh: vi.fn(),
    mockOperatorFindUnique: vi.fn(),
  }));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookiesGet,
    set: mockCookiesSet,
  }),
}));

vi.mock('@/lib/auth/operatorSession', () => ({
  verifyOpRefreshToken: mockVerifyOpRefreshToken,
  rotateOperatorRefresh: mockRotateOperatorRefresh,
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    operatorUser: { findUnique: mockOperatorFindUnique },
  },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/op/auth/refresh', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: operator exists and does not require password change
  mockOperatorFindUnique.mockResolvedValue({ requiresPasswordChange: false, operatorId: 'op-org-1' });
});

describe('POST /api/op/auth/refresh', () => {
  it('returns 401 NO_SESSION when cookie absent', async () => {
    mockCookiesGet.mockReturnValue(undefined);
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('NO_SESSION');
  });

  it('returns 401 INVALID_SESSION for malformed token', async () => {
    mockCookiesGet.mockReturnValue({ value: 'bad-token' });
    mockVerifyOpRefreshToken.mockReturnValue(null);
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('INVALID_SESSION');
    // Cookies cleared
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_op_access', '', { maxAge: 0, path: '/' });
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_op_refresh', '', { maxAge: 0, path: '/' });
  });

  it('returns 401 INVALID_SESSION when rotateOperatorRefresh throws', async () => {
    mockCookiesGet.mockReturnValue({ value: 'valid-token' });
    mockVerifyOpRefreshToken.mockReturnValue({ payload: { operatorUserId: 'op-1' }, hash: 'hash1' });
    mockRotateOperatorRefresh.mockRejectedValue(new Error('SESSION_NOT_FOUND'));
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('INVALID_SESSION');
  });

  it('returns 401 SESSION_REUSE on family reuse detection', async () => {
    mockCookiesGet.mockReturnValue({ value: 'reused-token' });
    mockVerifyOpRefreshToken.mockReturnValue({ payload: { operatorUserId: 'op-1' }, hash: 'hash1' });
    mockRotateOperatorRefresh.mockResolvedValue({ reuse: true });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('SESSION_REUSE');
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_op_access', '', { maxAge: 0, path: '/' });
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_op_refresh', '', { maxAge: 0, path: '/' });
  });

  it('returns 200 with accessToken and rotates cookies on success', async () => {
    mockCookiesGet.mockReturnValue({ value: 'valid-token' });
    mockVerifyOpRefreshToken.mockReturnValue({ payload: { operatorUserId: 'op-1' }, hash: 'hash1' });
    mockRotateOperatorRefresh.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      refreshHash: 'new-hash',
    });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.accessToken).toBe('new-access-token');
    // bb_op_access cookie set
    expect(mockCookiesSet).toHaveBeenCalledWith(
      'bb_op_access',
      'new-access-token',
      expect.objectContaining({ httpOnly: true, maxAge: 15 * 60 })
    );
    // bb_op_refresh cookie rotated
    expect(mockCookiesSet).toHaveBeenCalledWith(
      'bb_op_refresh',
      'new-refresh-token',
      expect.objectContaining({ httpOnly: true, maxAge: 30 * 24 * 60 * 60 })
    );
  });
});
