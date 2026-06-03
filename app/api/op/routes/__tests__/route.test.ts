/**
 * Unit tests for /api/op/routes (collection — Issue 012).
 *
 * Coverage:
 *   GET  — 200 { routes }, 401 no cookie
 *   POST — 201 on create, 422 invalid_input, 401 no cookie
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockListRoutes,
  mockCreateRoute,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockListRoutes: vi.fn(),
  mockCreateRoute: vi.fn(),
  mockCookieStore: { get: vi.fn() },
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/core/db/client', () => ({
  prisma: { operatorUser: { findUnique: mockOperatorFindUnique } },
}));
vi.mock('@/lib/catalog/listRoutes', () => ({ listRoutes: mockListRoutes }));
vi.mock('@/lib/catalog/createRoute', () => ({ createRoute: mockCreateRoute }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { GET, POST } from '../route';
import { NextRequest } from 'next/server';

const OP_USER = {
  id: 'ou1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: 'op-org-1',
};

const ROUTE_1 = {
  id: 'r1',
  operatorId: 'op-org-1',
  origin: 'Hà Nội',
  destination: 'TP.HCM',
  durationMinutes: 900,
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({
    sub: 'ou1',
    scope: 'operator',
    requiresPasswordChange: false,
    operatorId: 'op-org-1',
  });
  mockOperatorFindUnique.mockResolvedValue(OP_USER);
  mockListRoutes.mockResolvedValue([ROUTE_1]);
  mockCreateRoute.mockResolvedValue(ROUTE_1);
});

function makeGet() {
  return new NextRequest('http://localhost/api/op/routes', {
    method: 'GET',
    headers: { Cookie: 'bb_op_access=valid-token' },
  });
}

function makePost(body: unknown) {
  return new NextRequest('http://localhost/api/op/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: 'bb_op_access=valid-token' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/op/routes', () => {
  it('returns 200 { routes } scoped to operatorId', async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.routes).toHaveLength(1);
    expect(mockListRoutes).toHaveBeenCalledWith({ operatorId: 'op-org-1' });
  });

  it('returns 401 when no cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });
});

describe('POST /api/op/routes', () => {
  it('returns 201 { route } on valid create', async () => {
    const res = await POST(
      makePost({ origin: 'Hà Nội', destination: 'TP.HCM', durationMinutes: 900 })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.route.id).toBe('r1');
    expect(mockCreateRoute).toHaveBeenCalledWith(
      expect.objectContaining({ operatorId: 'op-org-1' })
    );
  });

  it('returns 422 invalid_input on missing origin', async () => {
    const res = await POST(makePost({ destination: 'TP.HCM', durationMinutes: 900 }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('invalid_input');
  });

  it('returns 422 invalid_input on durationMinutes=0 (below min 1)', async () => {
    const res = await POST(
      makePost({ origin: 'A', destination: 'B', durationMinutes: 0 })
    );
    expect(res.status).toBe(422);
  });

  it('returns 400 bad_request on malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/op/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'bb_op_access=valid-token' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when no cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost({ origin: 'A', destination: 'B', durationMinutes: 60 }));
    expect(res.status).toBe(401);
  });
});
