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

vi.mock('@/lib/core/db/client', () => ({
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
  operatorId: string;
  role: 'admin' | 'staff';
  assignedTripId: string | null;
}> = {}) {
  return {
    id: 'op-1',
    phone: '+8490xxxxxx1',
    displayName: 'Seed Admin',
    requiresPasswordChange: false,
    disabledAt: null,
    operatorId: 'op-org-1',
    role: 'admin' as 'admin' | 'staff',
    assignedTripId: null as string | null,
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

  // ---------------------------------------------------------------------------
  // (f) Issue 018 staff-scope guard
  // ---------------------------------------------------------------------------

  describe('(f) staffTripScope guard', () => {
    function primeStaff(assignedTripId: string | null) {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyOperatorAccess.mockResolvedValue({ sub: 'op-1', scope: 'operator', requiresPasswordChange: false });
      mockPrismaOperatorUser.findUnique.mockResolvedValue(
        makeOperator({ role: 'staff', assignedTripId })
      );
    }

    it('invokes the handler when the resolved tripId matches the staff assignment', async () => {
      primeStaff('trip-1');

      const handler = requireOperatorAuth({ staffTripScope: () => 'trip-1' })(fakeHandler);
      const res = await handler(makeRequest({ cookie: 'valid-token' }));

      expect(fakeHandler).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it('returns 404 when the resolved tripId is a different trip (cross-trip)', async () => {
      primeStaff('trip-1');

      const handler = requireOperatorAuth({ staffTripScope: () => 'trip-2' })(fakeHandler);
      const res = await handler(makeRequest({ cookie: 'valid-token' }));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('not_found');
      expect(fakeHandler).not.toHaveBeenCalled();
    });

    it('returns 404 when the staff member has no assignment (assignedTripId=null)', async () => {
      primeStaff(null);

      const handler = requireOperatorAuth({ staffTripScope: () => 'trip-1' })(fakeHandler);
      const res = await handler(makeRequest({ cookie: 'valid-token' }));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('not_found');
      expect(fakeHandler).not.toHaveBeenCalled();
    });

    it('returns 404 when the resolver cannot map the target to a trip (returns null)', async () => {
      primeStaff('trip-1');

      const handler = requireOperatorAuth({ staffTripScope: () => null })(fakeHandler);
      const res = await handler(makeRequest({ cookie: 'valid-token' }));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('not_found');
      expect(fakeHandler).not.toHaveBeenCalled();
    });

    it('reflects a re-assignment on the next request (fresh assignedTripId read)', async () => {
      // First request: assigned to trip-1, resolver targets trip-1 → admitted.
      primeStaff('trip-1');
      const handler = requireOperatorAuth({ staffTripScope: () => 'trip-1' })(fakeHandler);
      const first = await handler(makeRequest({ cookie: 'valid-token' }));
      expect(first.status).toBe(200);

      // Admin re-assigns to trip-2 (Issue 017). Next request reads the fresh
      // assignment; the same resolver targeting trip-1 is now a cross-trip 404.
      vi.clearAllMocks();
      fakeHandler.mockResolvedValue(NextResponse.json({ ok: true }));
      primeStaff('trip-2');
      const second = await handler(makeRequest({ cookie: 'valid-token' }));
      expect(second.status).toBe(404);
      expect(fakeHandler).not.toHaveBeenCalled();
    });

    it('admin role bypasses the staff-scope guard regardless of resolver value', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyOperatorAccess.mockResolvedValue({ sub: 'op-1', scope: 'operator', requiresPasswordChange: false });
      mockPrismaOperatorUser.findUnique.mockResolvedValue(
        makeOperator({ role: 'admin', assignedTripId: null })
      );

      const resolver = vi.fn(() => 'trip-99');
      const handler = requireOperatorAuth({ staffTripScope: resolver })(fakeHandler);
      const res = await handler(makeRequest({ cookie: 'valid-token' }));

      expect(fakeHandler).toHaveBeenCalled();
      expect(res.status).toBe(200);
      expect(resolver).not.toHaveBeenCalled();
    });
  });
});
