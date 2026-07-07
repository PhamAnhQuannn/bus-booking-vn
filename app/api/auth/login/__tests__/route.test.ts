/**
 * Unit tests for POST /api/auth/login.
 * Two branches: customer (email+password) and operator (username+password).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockLogin,
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
    mockLogin: vi.fn(),
    mockOperatorLogin: vi.fn(),
    mockCookieStore,
    AuthServiceError,
    mockOpLoginRatelimit: { limit: vi.fn() },
    mockOpLoginLockout: { limit: vi.fn() },
  };
});

vi.mock('@/lib/auth/operatorAuthService', () => ({ operatorLogin: mockOperatorLogin, AuthServiceError }));
vi.mock('@/lib/auth/authService', () => ({ login: mockLogin, AuthServiceError }));
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

const CUSTOMER_AUTH_RESULT = {
  accessToken: 'customer-access-token',
  refreshToken: 'customer-refresh-token',
  refreshHash: 'customer-hash',
  csrf: 'csrf-token',
  customer: { id: 'cust-1', email: 'test@example.com', displayName: 'Test User' },
};

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
  mockLogin.mockResolvedValue(CUSTOMER_AUTH_RESULT);
  mockOperatorLogin.mockResolvedValue(OP_AUTH_RESULT);
  mockOpLoginRatelimit.limit.mockResolvedValue(ALLOW);
  mockOpLoginLockout.limit.mockResolvedValue(ALLOW);
});

describe('POST /api/auth/login', () => {
  describe('customer scope', () => {
    it('returns 200 with accessToken + customer on valid credentials', async () => {
      const res = await POST(makeRequest({ email: 'test@example.com', password: 'Password1' }));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.accessToken).toBe('customer-access-token');
      expect(json.customer).toEqual({ id: 'cust-1', email: 'test@example.com', displayName: 'Test User' });
      expect(mockLogin).toHaveBeenCalledWith({ email: 'test@example.com', password: 'Password1' });
    });

    it('sets bb_rt cookie on customer login', async () => {
      await POST(makeRequest({ email: 'test@example.com', password: 'Password1' }));
      const calls = mockCookieStore.set.mock.calls.map((c: string[]) => c[0]);
      expect(calls).toContain('bb_rt');
      expect(calls).not.toContain('bb_op_access');
      expect(calls).not.toContain('bb_op_refresh');
    });

    it('returns 401 for invalid customer credentials', async () => {
      mockLogin.mockRejectedValue(new AuthServiceError('INVALID_CREDENTIALS'));
      const res = await POST(makeRequest({ email: 'test@example.com', password: 'wrong' }));
      const json = await res.json();
      expect(res.status).toBe(401);
      expect(json.error).toBe('invalid_credentials');
    });

    it('returns 400 for missing email', async () => {
      const res = await POST(makeRequest({ password: 'Password1' }));
      expect(res.status).toBe(400);
    });

    it('does not invoke operatorLogin for customer scope', async () => {
      await POST(makeRequest({ email: 'test@example.com', password: 'Password1' }));
      expect(mockOperatorLogin).not.toHaveBeenCalled();
    });

    it('defaults to customer scope when scope is absent', async () => {
      await POST(makeRequest({ email: 'test@example.com', password: 'Password1' }));
      expect(mockLogin).toHaveBeenCalled();
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
