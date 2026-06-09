/**
 * Unit tests for POST /api/auth/login.
 * 2026-06-06: customer accounts PAUSED — any non-operator scope returns 410. The
 * operator path logs in by username (not phone).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockOperatorLogin, mockCookieStore, AuthServiceError } = vi.hoisted(() => {
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
    mockOperatorLogin: vi.fn(),
    mockCookieStore,
    AuthServiceError,
  };
});

vi.mock('@/lib/auth/operatorAuthService', () => ({ operatorLogin: mockOperatorLogin, AuthServiceError }));
// The route imports AuthServiceError via the @/lib/auth barrel (→ authService); mock it
// with the SAME hoisted class so `instanceof AuthServiceError` matches the thrown error.
vi.mock('@/lib/auth/authService', () => ({ AuthServiceError }));
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

const OP_AUTH_RESULT = {
  accessToken: 'op-access-token',
  refreshToken: 'op-refresh-token',
  refreshHash: 'op-hash',
  operator: {
    id: 'op-1',
    username: 'PB-0001',
    displayName: 'Op Admin',
    requiresPasswordChange: false,
  },
  requiresPasswordChange: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockOperatorLogin.mockResolvedValue(OP_AUTH_RESULT);
});

describe('POST /api/auth/login', () => {
  describe('customer scope (paused)', () => {
    it('returns 410 with no scope', async () => {
      const res = await POST(makeRequest({ username: 'x', password: 'Password1' }));
      const json = await res.json();
      expect(res.status).toBe(410);
      expect(json.error).toBe('customer_login_disabled');
    });

    it('returns 410 with scope: customer', async () => {
      const res = await POST(makeRequest({ username: 'x', password: 'Password1', scope: 'customer' }));
      expect(res.status).toBe(410);
    });

    it('does not invoke operatorLogin for a customer scope', async () => {
      await POST(makeRequest({ username: 'x', password: 'Password1', scope: 'customer' }));
      expect(mockOperatorLogin).not.toHaveBeenCalled();
    });
  });

  describe('operator scope', () => {
    it('returns 200 with operator accessToken on valid credentials', async () => {
      const res = await POST(makeRequest({ username: 'PB-0001', password: 'OpPass1', scope: 'operator' }));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.accessToken).toBe('op-access-token');
      expect(json.operator).toBeDefined();
      expect(mockOperatorLogin).toHaveBeenCalledWith({ username: 'PB-0001', password: 'OpPass1' });
    });

    it('sets bb_op_access and bb_op_refresh cookies on operator login', async () => {
      await POST(makeRequest({ username: 'PB-0001', password: 'OpPass1', scope: 'operator' }));
      const calls = mockCookieStore.set.mock.calls.map((c: string[]) => c[0]);
      expect(calls).toContain('bb_op_access');
      expect(calls).toContain('bb_op_refresh');
    });

    it('returns 400 for a missing username', async () => {
      const res = await POST(makeRequest({ password: 'OpPass1', scope: 'operator' }));
      expect(res.status).toBe(400);
    });

    it('returns 401 for invalid operator credentials', async () => {
      mockOperatorLogin.mockRejectedValue(new AuthServiceError('INVALID_CREDENTIALS'));
      const res = await POST(makeRequest({ username: 'PB-0001', password: 'wrong', scope: 'operator' }));
      expect(res.status).toBe(401);
    });

    it('does NOT set customer cookie on operator login', async () => {
      await POST(makeRequest({ username: 'PB-0001', password: 'OpPass1', scope: 'operator' }));
      const calls = mockCookieStore.set.mock.calls.map((c: string[]) => c[0]);
      expect(calls).not.toContain('bb_rt');
    });
  });
});
