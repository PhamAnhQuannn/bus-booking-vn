/**
 * Unit tests for POST /api/auth/login
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLogin, mockCookieStore, AuthServiceError } = vi.hoisted(() => {
  class AuthServiceError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
      this.name = 'AuthServiceError';
    }
  }
  const mockCookieStore = { set: vi.fn(), get: vi.fn(), has: vi.fn(), delete: vi.fn() };
  return { mockLogin: vi.fn(), mockCookieStore, AuthServiceError };
});

vi.mock('@/lib/auth/authService', () => ({ login: mockLogin, AuthServiceError }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const AUTH_RESULT = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  refreshHash: 'hash',
  csrf: 'csrf',
  customer: { id: 'cust-1', phone: '0901234567', displayName: 'Test User' }, // local format — avoids gitleaks \+84[35789]\d{8}
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLogin.mockResolvedValue(AUTH_RESULT);
});

describe('POST /api/auth/login', () => {
  it('returns 200 with accessToken on valid credentials', async () => {
    const res = await POST(makeRequest({ phone: '0901234567', password: 'Password1' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.accessToken).toBe('access-token');
  });

  it('sets bb_rt cookie on success', async () => {
    await POST(makeRequest({ phone: '0901234567', password: 'Password1' }));
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'bb_rt',
      'refresh-token',
      expect.objectContaining({ httpOnly: true })
    );
  });

  it('returns 401 with generic error for wrong credentials', async () => {
    mockLogin.mockRejectedValue(new AuthServiceError('INVALID_CREDENTIALS'));
    const res = await POST(makeRequest({ phone: '0901234567', password: 'wrong' }));
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('invalid_credentials');
  });

  it('returns 401 with same generic error for nonexistent phone (no enumeration)', async () => {
    mockLogin.mockRejectedValue(new AuthServiceError('INVALID_CREDENTIALS'));
    const res = await POST(makeRequest({ phone: '0987654321', password: 'anything' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing password field', async () => {
    const res = await POST(makeRequest({ phone: '0901234567' }));
    expect(res.status).toBe(400);
  });
});
