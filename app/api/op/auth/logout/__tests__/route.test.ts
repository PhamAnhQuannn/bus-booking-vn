/**
 * Unit tests for POST /api/op/auth/logout
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCookiesGet, mockCookiesSet, mockVerifyOpRefreshToken, mockRevokeOperatorSession } =
  vi.hoisted(() => ({
    mockCookiesGet: vi.fn(),
    mockCookiesSet: vi.fn(),
    mockVerifyOpRefreshToken: vi.fn(),
    mockRevokeOperatorSession: vi.fn(),
  }));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookiesGet,
    set: mockCookiesSet,
  }),
}));

vi.mock('@/lib/auth/operatorSession', () => ({
  verifyOpRefreshToken: mockVerifyOpRefreshToken,
  revokeOperatorSession: mockRevokeOperatorSession,
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/op/auth/logout', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRevokeOperatorSession.mockResolvedValue(undefined);
});

describe('POST /api/op/auth/logout', () => {
  it('returns 204 and clears cookies even with no refresh cookie', async () => {
    mockCookiesGet.mockReturnValue(undefined);
    const res = await POST(makeRequest());
    expect(res.status).toBe(204);
    expect(mockRevokeOperatorSession).not.toHaveBeenCalled();
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_op_access', '', expect.objectContaining({ maxAge: 0 }));
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_op_refresh', '', expect.objectContaining({ maxAge: 0 }));
  });

  it('returns 204 and skips revoke for malformed token', async () => {
    mockCookiesGet.mockReturnValue({ value: 'bad-token' });
    mockVerifyOpRefreshToken.mockReturnValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(204);
    expect(mockRevokeOperatorSession).not.toHaveBeenCalled();
  });

  it('revokes session and clears cookies on valid token', async () => {
    mockCookiesGet.mockReturnValue({ value: 'valid-token' });
    mockVerifyOpRefreshToken.mockReturnValue({ payload: { operatorUserId: 'op-1' }, hash: 'hash1' });
    const res = await POST(makeRequest());
    expect(res.status).toBe(204);
    expect(mockRevokeOperatorSession).toHaveBeenCalledWith('hash1');
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_op_access', '', expect.objectContaining({ maxAge: 0, httpOnly: true }));
    expect(mockCookiesSet).toHaveBeenCalledWith('bb_op_refresh', '', expect.objectContaining({ maxAge: 0, httpOnly: true }));
  });

  it('still returns 204 even if revokeOperatorSession throws', async () => {
    mockCookiesGet.mockReturnValue({ value: 'valid-token' });
    mockVerifyOpRefreshToken.mockReturnValue({ payload: { operatorUserId: 'op-1' }, hash: 'hash1' });
    mockRevokeOperatorSession.mockRejectedValue(new Error('DB error'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(204);
  });
});
