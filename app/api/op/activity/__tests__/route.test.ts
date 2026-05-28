/**
 * Unit tests for /api/op/activity (Issue 024).
 *
 * Coverage:
 *   - 401 without operator session
 *   - happy path returns { events: [...] }
 *   - tenant scoping: getActivityFeed receives ctx.operatorId from the JWT (not the URL)
 *   - limit clamp: 9999 → 100, -5 → 1, "abc" → 30 fallback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockGetActivityFeed,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockGetActivityFeed: vi.fn(),
  mockCookieStore: { get: vi.fn() },
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    operatorUser: { findUnique: mockOperatorFindUnique },
  },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('@/lib/op/getActivityFeed', () => ({ getActivityFeed: mockGetActivityFeed }));

import { GET } from '../route';
import { NextRequest } from 'next/server';

const OPERATOR_USER = {
  id: 'op-user-1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  role: 'admin' as const,
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: 'op-org-A',
};

function makeGet(limitParam?: string): NextRequest {
  const url = limitParam !== undefined
    ? `http://localhost/api/op/activity?limit=${limitParam}`
    : 'http://localhost/api/op/activity';
  return new NextRequest(url, {
    method: 'GET',
    headers: { Cookie: 'bb_op_access=valid-token' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({
    sub: 'op-user-1',
    scope: 'operator',
    requiresPasswordChange: false,
    operatorId: 'op-org-A',
    role: 'admin',
  });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_USER);
  mockGetActivityFeed.mockResolvedValue([]);
});

describe('GET /api/op/activity', () => {
  it('returns 401 when no operator session cookie present', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it('returns 200 { events: [...] } on the happy path', async () => {
    mockGetActivityFeed.mockResolvedValue([
      { id: 'booking.paid:b1:0', type: 'booking.paid', ts: '2026-05-28T00:00:00.000Z', severity: 'success', title: 'x', body: 'y', href: '/op/bookings/b1' },
    ]);
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.events).toHaveLength(1);
    expect(json.events[0].type).toBe('booking.paid');
  });

  it('passes ctx.operatorId from the JWT (NOT from URL/body) to getActivityFeed', async () => {
    // Even if a malicious client wedged ?operatorId=op-org-B into the URL, the route
    // should ignore it and use the operator from the verified JWT.
    const url = 'http://localhost/api/op/activity?operatorId=op-org-B';
    const req = new NextRequest(url, {
      method: 'GET',
      headers: { Cookie: 'bb_op_access=valid-token' },
    });
    await GET(req);
    expect(mockGetActivityFeed).toHaveBeenCalledWith(
      expect.objectContaining({ operatorId: 'op-org-A' })
    );
  });

  describe('limit clamp', () => {
    it('clamps limit=9999 to 100', async () => {
      await GET(makeGet('9999'));
      expect(mockGetActivityFeed).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });

    it('clamps limit=-5 to 1', async () => {
      await GET(makeGet('-5'));
      expect(mockGetActivityFeed).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 1 })
      );
    });

    it('falls back to 30 when limit is non-numeric', async () => {
      await GET(makeGet('abc'));
      expect(mockGetActivityFeed).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 30 })
      );
    });

    it('uses default 30 when limit omitted', async () => {
      await GET(makeGet());
      expect(mockGetActivityFeed).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 30 })
      );
    });
  });
});
