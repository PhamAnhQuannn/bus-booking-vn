/**
 * Unit tests for POST /api/auth/login.
 * 2026-06-06: customer accounts PAUSED — any non-operator scope returns 410. The
 * operator path logs in by username (not phone).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockOperatorLogin,
  mockCookieStore,
  AuthServiceError,
  mockOpLoginRatelimit,
  mockOpLoginLockout,
} = vi.hoisted(() => {
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
    mockOpLoginRatelimit: { limit: vi.fn() },
    mockOpLoginLockout: { limit: vi.fn() },
  };
});

vi.mock('@/lib/auth/operatorAuthService', () => ({ operatorLogin: mockOperatorLogin, AuthServiceError }));
// The route imports AuthServiceError via the @/lib/auth barrel (→ authService); mock it
// with the SAME hoisted class so `instanceof AuthServiceError` matches the thrown error.
vi.mock('@/lib/auth/authService', () => ({ AuthServiceError }));
// Partial mock — spread the real module so barrel co-consumers (e.g. operatorOtp's
// createRatelimit) still resolve; override only the two login limiters.
vi.mock('@/lib/ratelimit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ratelimit')>()),
  opLoginRatelimit: mockOpLoginRatelimit,
  opLoginLockout: mockOpLoginLockout,
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

const ALLOW = { allowed: true, remaining: 9, retryAfter: 0 };
const DENY = { allowed: false, remaining: 0, retryAfter: 900 };

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
  mockOpLoginRatelimit.limit.mockResolvedValue(ALLOW);
  mockOpLoginLockout.limit.mockResolvedValue(ALLOW);
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

  describe('rate-limit + account lockout', () => {
    it('returns 429 RATE_LIMITED when the per-IP login throttle is exhausted', async () => {
      mockOpLoginRatelimit.limit.mockResolvedValue(DENY);
      const res = await POST(makeRequest({ username: 'PB-0001', password: 'OpPass1', scope: 'operator' }));
      const json = await res.json();
      expect(res.status).toBe(429);
      expect(json.error).toBe('RATE_LIMITED');
      expect(res.headers.get('Retry-After')).toBe('900');
      // Throttled before the credential check — operatorLogin never runs.
      expect(mockOperatorLogin).not.toHaveBeenCalled();
    });

    it('returns 429 LOCKED_OUT once the consecutive-failure lockout is exhausted', async () => {
      mockOperatorLogin.mockRejectedValue(new AuthServiceError('INVALID_CREDENTIALS'));
      mockOpLoginLockout.limit.mockResolvedValue(DENY);
      const res = await POST(makeRequest({ username: 'PB-0001', password: 'wrong', scope: 'operator' }));
      const json = await res.json();
      expect(res.status).toBe(429);
      expect(json.error).toBe('LOCKED_OUT');
      expect(res.headers.get('Retry-After')).toBe('900');
    });

    it('keys the lockout on the case-normalized username, consumed only on bad credentials', async () => {
      mockOperatorLogin.mockRejectedValue(new AuthServiceError('INVALID_CREDENTIALS'));
      await POST(makeRequest({ username: '  PB-0001  ', password: 'wrong', scope: 'operator' }));
      expect(mockOpLoginLockout.limit).toHaveBeenCalledWith('op-login-fail:pb-0001');
    });

    it('does NOT consume the lockout on a successful login', async () => {
      await POST(makeRequest({ username: 'PB-0001', password: 'OpPass1', scope: 'operator' }));
      expect(mockOpLoginLockout.limit).not.toHaveBeenCalled();
    });
  });
});
