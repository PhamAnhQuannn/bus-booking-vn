/**
 * Unit tests for POST /api/auth/refresh
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRefresh, mockCookieStore, AuthServiceError } = vi.hoisted(() => {
  class AuthServiceError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
      this.name = 'AuthServiceError';
    }
  }
  const mockCookieStore = {
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(),
    delete: vi.fn(),
  };
  return { mockRefresh: vi.fn(), mockCookieStore, AuthServiceError };
});

vi.mock('@/lib/auth/authService', () => ({ refresh: mockRefresh, AuthServiceError }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/auth/refresh', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-refresh-token' });
  mockRefresh.mockResolvedValue({
    accessToken: 'new-access',
    refreshToken: 'new-refresh',
    refreshHash: 'new-hash',
    csrf: 'new-csrf',
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns 200 with new accessToken', async () => {
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.accessToken).toBe('new-access');
  });

  it('sets new bb_rt cookie on rotation', async () => {
    await POST(makeRequest());
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'bb_rt',
      'new-refresh',
      expect.objectContaining({ httpOnly: true })
    );
  });

  it('returns 401 no_session when no cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('no_session');
  });

  it('returns 401 session_reuse on reuse attack', async () => {
    mockRefresh.mockRejectedValue(new AuthServiceError('SESSION_REUSE'));
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('session_reuse');
  });

  it('clears cookie on session_reuse', async () => {
    mockRefresh.mockRejectedValue(new AuthServiceError('SESSION_REUSE'));
    await POST(makeRequest());
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'bb_rt',
      '',
      expect.objectContaining({ maxAge: 0 })
    );
  });

  it('returns 401 invalid_session for REFRESH_INVALID', async () => {
    mockRefresh.mockRejectedValue(new AuthServiceError('REFRESH_INVALID'));
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('invalid_session');
  });

  it('returns 401 invalid_session for SESSION_NOT_FOUND', async () => {
    mockRefresh.mockRejectedValue(new AuthServiceError('SESSION_NOT_FOUND'));
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('invalid_session');
  });
});
