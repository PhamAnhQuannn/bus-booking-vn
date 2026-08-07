/**
 * Unit tests for POST /api/auth/login.
 * Dispatches on `scope`: operator (username+password, optional 2FA) or customer
 * (email+password, ADR-021).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockOperatorLogin,
  mockCustomerLogin,
  mockCookieStore,
  AuthServiceError,
  mockOpLoginRatelimit,
  mockOpLoginLockout,
  mockCustomerLoginRatelimit,
  mockCustomerLoginLockout,
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
    mockCustomerLogin: vi.fn(),
    mockCookieStore,
    AuthServiceError,
    mockOpLoginRatelimit: { limit: vi.fn() },
    mockOpLoginLockout: { limit: vi.fn() },
    mockCustomerLoginRatelimit: { limit: vi.fn() },
    mockCustomerLoginLockout: { limit: vi.fn() },
  };
});

vi.mock('@/lib/auth/operatorAuthService', () => ({ operatorLogin: mockOperatorLogin }));
vi.mock('@/lib/auth/authService', () => ({ AuthServiceError, login: mockCustomerLogin }));
vi.mock('@/lib/ratelimit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ratelimit')>()),
  opLoginRatelimit: mockOpLoginRatelimit,
  opLoginLockout: mockOpLoginLockout,
  customerLoginRatelimit: mockCustomerLoginRatelimit,
  customerLoginLockout: mockCustomerLoginLockout,
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
  otpRequired: false as const,
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

const CUST_AUTH_RESULT = {
  accessToken: 'cust-access-token',
  refreshToken: 'cust-refresh-token',
  refreshHash: 'cust-hash',
  csrf: 'cust-csrf',
  customer: { id: 'cust-1', email: 'test@example.com', displayName: 'Trav Eler' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockOperatorLogin.mockResolvedValue(OP_AUTH_RESULT);
  mockCustomerLogin.mockResolvedValue(CUST_AUTH_RESULT);
  mockOpLoginRatelimit.limit.mockResolvedValue(ALLOW);
  mockOpLoginLockout.limit.mockResolvedValue(ALLOW);
  mockCustomerLoginRatelimit.limit.mockResolvedValue(ALLOW);
  mockCustomerLoginLockout.limit.mockResolvedValue(ALLOW);
});

describe('POST /api/auth/login', () => {
  describe('customer scope (email+password)', () => {
    it('returns 200 with accessToken + customer and sets bb_rt on valid credentials', async () => {
      const res = await POST(makeRequest({ email: 'test@example.com', password: 'Password1' }));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.accessToken).toBe('cust-access-token');
      expect(json.customer).toEqual(CUST_AUTH_RESULT.customer);
      expect(mockCustomerLogin).toHaveBeenCalledWith({ email: 'test@example.com', password: 'Password1' });
      const setCalls = mockCookieStore.set.mock.calls;
      const rt = setCalls.find((c: unknown[]) => c[0] === 'bb_rt');
      expect(rt).toBeDefined();
      expect(rt![2]).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    });

    it('does NOT set operator cookies on customer login', async () => {
      await POST(makeRequest({ email: 'test@example.com', password: 'Password1' }));
      const names = mockCookieStore.set.mock.calls.map((c: string[]) => c[0]);
      expect(names).not.toContain('bb_op_access');
      expect(names).not.toContain('bb_op_refresh');
    });

    it('returns 401 invalid_credentials on bad credentials', async () => {
      mockCustomerLogin.mockRejectedValue(new AuthServiceError('INVALID_CREDENTIALS'));
      const res = await POST(makeRequest({ email: 'test@example.com', password: 'wrongpass1' }));
      const json = await res.json();
      expect(res.status).toBe(401);
      expect(json.error).toBe('invalid_credentials');
    });

    it('returns 400 INVALID for a malformed email', async () => {
      const res = await POST(makeRequest({ email: 'not-an-email', password: 'Password1' }));
      expect(res.status).toBe(400);
      expect(mockCustomerLogin).not.toHaveBeenCalled();
    });

    it('returns 429 RATE_LIMITED when the per-IP throttle is exhausted', async () => {
      mockCustomerLoginRatelimit.limit.mockResolvedValue(DENY);
      const res = await POST(makeRequest({ email: 'test@example.com', password: 'Password1' }));
      const json = await res.json();
      expect(res.status).toBe(429);
      expect(json.error).toBe('RATE_LIMITED');
      expect(mockCustomerLogin).not.toHaveBeenCalled();
    });

    it('returns 429 LOCKED_OUT once the per-email lockout is exhausted', async () => {
      mockCustomerLogin.mockRejectedValue(new AuthServiceError('INVALID_CREDENTIALS'));
      mockCustomerLoginLockout.limit.mockResolvedValue(DENY);
      const res = await POST(makeRequest({ email: 'Test@Example.com', password: 'wrongpass1' }));
      const json = await res.json();
      expect(res.status).toBe(429);
      expect(json.error).toBe('LOCKED_OUT');
      expect(mockCustomerLoginLockout.limit).toHaveBeenCalledWith('customer-login-fail:test@example.com');
    });

    it('does NOT consume the lockout on a successful login', async () => {
      await POST(makeRequest({ email: 'test@example.com', password: 'Password1' }));
      expect(mockCustomerLoginLockout.limit).not.toHaveBeenCalled();
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

    it('returns otpRequired when operator has email (2FA)', async () => {
      mockOperatorLogin.mockResolvedValue({
        otpRequired: true as const,
        loginChallenge: 'challenge-jwt',
        maskedEmail: 'o***@example.com',
      });

      const res = await POST(makeRequest({ username: 'PB-0001', password: 'OpPass1', scope: 'operator' }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.otpRequired).toBe(true);
      expect(json.loginChallenge).toBe('challenge-jwt');
      expect(json.maskedEmail).toBe('o***@example.com');
      expect(json.accessToken).toBeUndefined();
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it('returns 429 OTP_LOCKED_OUT when OTP lockout active', async () => {
      mockOperatorLogin.mockRejectedValue(new AuthServiceError('OTP_LOCKED_OUT'));

      const res = await POST(makeRequest({ username: 'PB-0001', password: 'OpPass1', scope: 'operator' }));
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.error).toBe('OTP_LOCKED_OUT');
    });

    it('returns 429 OTP_RATE_LIMITED when OTP rate limited', async () => {
      mockOperatorLogin.mockRejectedValue(new AuthServiceError('OTP_RATE_LIMITED'));

      const res = await POST(makeRequest({ username: 'PB-0001', password: 'OpPass1', scope: 'operator' }));
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.error).toBe('OTP_RATE_LIMITED');
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
