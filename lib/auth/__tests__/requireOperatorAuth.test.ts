/**
 * Unit tests for lib/auth/requireOperatorAuth.ts
 *
 * Tests the HOF behavior:
 * (a) no cookie → 401 UNAUTHORIZED
 * (b) expired/invalid access token → 401 UNAUTHORIZED
 * (c) valid access + requiresPasswordChange=true + allowDuringPasswordChange=false → 403
 * (d) valid access + requiresPasswordChange=false → handler invoked
 * (e) cross-scope rejection — customer-scope JWT in bb_op_access cookie → 401
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockCookieStore = vi.hoisted(() => ({
  get: vi.fn(),
}));

const mockVerifyOperatorAccess = vi.hoisted(() => vi.fn());

const mockPrismaOperatorUser = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    operatorUser: mockPrismaOperatorUser,
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { requireOperatorAuth } from '../requireOperatorAuth';
import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(opts: { cookie?: string } = {}): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (opts.cookie) {
    headers.set('Cookie', `bb_op_access=${opts.cookie}`);
  }
  return new NextRequest('http://localhost/api/op/profile', {
    method: 'GET',
    headers,
  });
}

function makeOperator(overrides: Partial<{
  id: string;
  phone: string;
  displayName: string;
  requiresPasswordChange: boolean;
  disabledAt: Date | null;
}> = {}) {
  return {
    id: 'op-1',
    phone: '+8490xxxxxx1',
    displayName: 'Seed Admin',
    requiresPasswordChange: false,
    disabledAt: null,
    ...overrides,
  };
}

const fakeHandler = vi.fn(async () => NextResponse.json({ ok: true }));

beforeEach(() => {
  vi.clearAllMocks();
  fakeHandler.mockResolvedValue(NextResponse.json({ ok: true }));
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireOperatorAuth', () => {
  describe('(a) no cookie', () => {
    it('returns 401 when bb_op_access cookie is absent', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const handler = requireOperatorAuth({})(fakeHandler);
      const res = await handler(makeRequest());

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('UNAUTHORIZED');
      expect(fakeHandler).not.toHaveBeenCalled();
    });
  });

  describe('(b) invalid/expired token', () => {
    it('returns 401 when verifyOperatorAccess returns null', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'bad-token' });
      mockVerifyOperatorAccess.mockResolvedValue(null);

      const handler = requireOperatorAuth({})(fakeHandler);
      const res = await handler(makeRequest({ cookie: 'bad-token' }));

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('UNAUTHORIZED');
      expect(fakeHandler).not.toHaveBeenCalled();
    });
  });

  describe('(c) valid access + requiresPasswordChange=true', () => {
    it('returns 403 PASSWORD_CHANGE_REQUIRED when allowDuringPasswordChange=false', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyOperatorAccess.mockResolvedValue({ sub: 'op-1', scope: 'operator', requiresPasswordChange: false });
      mockPrismaOperatorUser.findUnique.mockResolvedValue(
        makeOperator({ requiresPasswordChange: true })
      );

      const handler = requireOperatorAuth({ allowDuringPasswordChange: false })(fakeHandler);
      const res = await handler(makeRequest({ cookie: 'valid-token' }));

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('PASSWORD_CHANGE_REQUIRED');
      expect(fakeHandler).not.toHaveBeenCalled();
    });

    it('allows access when allowDuringPasswordChange=true', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyOperatorAccess.mockResolvedValue({ sub: 'op-1', scope: 'operator', requiresPasswordChange: false });
      mockPrismaOperatorUser.findUnique.mockResolvedValue(
        makeOperator({ requiresPasswordChange: true })
      );

      const handler = requireOperatorAuth({ allowDuringPasswordChange: true })(fakeHandler);
      const res = await handler(makeRequest({ cookie: 'valid-token' }));

      expect(fakeHandler).toHaveBeenCalled();
    });
  });

  describe('(d) valid access + requiresPasswordChange=false', () => {
    it('calls the wrapped handler', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyOperatorAccess.mockResolvedValue({ sub: 'op-1', scope: 'operator', requiresPasswordChange: false });
      mockPrismaOperatorUser.findUnique.mockResolvedValue(
        makeOperator({ requiresPasswordChange: false })
      );

      const handler = requireOperatorAuth({})(fakeHandler);
      const res = await handler(makeRequest({ cookie: 'valid-token' }));

      expect(fakeHandler).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it('returns 401 for disabled operator', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyOperatorAccess.mockResolvedValue({ sub: 'op-1', scope: 'operator', requiresPasswordChange: false });
      mockPrismaOperatorUser.findUnique.mockResolvedValue(
        makeOperator({ disabledAt: new Date() })
      );

      const handler = requireOperatorAuth({})(fakeHandler);
      const res = await handler(makeRequest({ cookie: 'valid-token' }));

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('UNAUTHORIZED');
    });
  });

  // ---------------------------------------------------------------------------
  // (e) cross-scope rejection — customer-scope JWT must not pass operator guard
  // ---------------------------------------------------------------------------

  describe('(e) cross-scope rejection', () => {
    it('returns 401 when verifyOperatorAccess returns null for a customer-scope JWT', async () => {
      // verifyOperatorAccess returns null for a no-scope / customer-scope token
      // (the actual jwt.ts logic rejects when scope !== 'operator')
      mockCookieStore.get.mockReturnValue({ value: 'customer-token' });
      mockVerifyOperatorAccess.mockResolvedValue(null); // null = scope mismatch rejection

      const handler = requireOperatorAuth({})(fakeHandler);
      const res = await handler(makeRequest({ cookie: 'customer-token' }));

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('UNAUTHORIZED');
      expect(fakeHandler).not.toHaveBeenCalled();
    });
  });
});
