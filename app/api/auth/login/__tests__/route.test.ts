/**
 * Unit tests for POST /api/auth/login
 * Covers both customer (no scope / scope:'customer') and operator (scope:'operator') paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLogin, mockOperatorLogin, mockCookieStore, AuthServiceError } = vi.hoisted(() => {
  class AuthServiceError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
      this.name = 'AuthServiceError';
    }
  }
  const mockCookieStore = { set: vi.fn(), get: vi.fn(), has: vi.fn(), delete: vi.fn() };
  return {
    mockLogin: vi.fn(),
    mockOperatorLogin: vi.fn(),
    mockCookieStore,
    AuthServiceError,
  };
});

vi.mock('@/lib/auth/authService', () => ({ login: mockLogin, AuthServiceError }));
vi.mock('@/lib/auth/operatorAuthService', () => ({ operatorLogin: mockOperatorLogin, AuthServiceError }));
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

const OP_AUTH_RESULT = {
  accessToken: 'op-access-token',
  refreshToken: 'op-refresh-token',
  refreshHash: 'op-hash',
  operator: {
    id: 'op-1',
    phone: '0901234567',
    displayName: 'Op Admin',
    requiresPasswordChange: false,
  },
  requiresPasswordChange: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLogin.mockResolvedValue(AUTH_RESULT);
  mockOperatorLogin.mockResolvedValue(OP_AUTH_RESULT);
});

describe('POST /api/auth/login', () => {
  // Customer scope (no scope field / scope: 'customer')
  describe('customer scope', () => {
    it('returns 200 with accessToken on valid credentials (no scope)', async () => {
      const res = await POST(makeRequest({ phone: '0901234567', password: 'Password1' }));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.accessToken).toBe('access-token');
    });

    it('returns 200 with accessToken on valid credentials (scope: customer)', async () => {
      const res = await POST(makeRequest({ phone: '0901234567', password: 'Password1', scope: 'customer' }));
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

  // Operator scope
  describe('operator scope', () => {
    it('returns 200 with operator accessToken on valid credentials', async () => {
      const res = await POST(makeRequest({ phone: '0901234567', password: 'OpPass1', scope: 'operator' }));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.accessToken).toBe('op-access-token');
      expect(json.operator).toBeDefined();
    });

    it('sets bb_op_access and bb_op_refresh cookies on operator login', async () => {
      await POST(makeRequest({ phone: '0901234567', password: 'OpPass1', scope: 'operator' }));
      const calls = mockCookieStore.set.mock.calls.map((c: string[]) => c[0]);
      expect(calls).toContain('bb_op_access');
      expect(calls).toContain('bb_op_refresh');
    });

    it('returns 401 for invalid operator credentials', async () => {
      mockOperatorLogin.mockRejectedValue(new AuthServiceError('INVALID_CREDENTIALS'));
      const res = await POST(makeRequest({ phone: '0901234567', password: 'wrong', scope: 'operator' }));
      expect(res.status).toBe(401);
    });

    it('does NOT set customer cookie on operator login', async () => {
      await POST(makeRequest({ phone: '0901234567', password: 'OpPass1', scope: 'operator' }));
      const calls = mockCookieStore.set.mock.calls.map((c: string[]) => c[0]);
      expect(calls).not.toContain('bb_rt');
    });
  });
});
