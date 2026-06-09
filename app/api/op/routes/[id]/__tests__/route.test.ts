/**
 * Unit tests for /api/op/routes/[id] (Issue 012).
 *
 * Coverage:
 *   GET   — 200 route, 404 not_found (cross-op)
 *   PATCH — 200 updated, 404 not_found, 422 reactivation_not_supported, 422 invalid_input
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockGetRouteById,
  mockUpdateRoute,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockGetRouteById: vi.fn(),
  mockUpdateRoute: vi.fn(),
  mockCookieStore: { get: vi.fn() },
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/core/db/client', () => ({
  prisma: { operatorUser: { findUnique: mockOperatorFindUnique } },
}));
vi.mock('@/lib/catalog/getRouteById', () => ({ getRouteById: mockGetRouteById }));
vi.mock('@/lib/catalog/updateRoute', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/catalog')>();
  return { ...actual, updateRoute: mockUpdateRoute };
});
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { GET, PATCH } from '../route';
import { NextRequest } from 'next/server';
import { RouteServiceError } from '@/lib/catalog';

const OP_USER = {
  id: 'ou1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: 'op-org-1',
};

const ROUTE = {
  id: 'r1',
  operatorId: 'op-org-1',
  origin: 'Hà Nội',
  destination: 'TP.HCM',
  durationMinutes: 900,
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeCtx(id = 'r1') {
  return { params: Promise.resolve({ id }) };
}

function makeGet(id = 'r1') {
  return new NextRequest(`http://localhost/api/op/routes/${id}`, {
    method: 'GET',
    headers: { Cookie: 'bb_op_access=valid-token' },
  });
}

function makePatch(id = 'r1', body: unknown = {}) {
  return new NextRequest(`http://localhost/api/op/routes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: 'bb_op_access=valid-token' },
    body: JSON.stringify(body),
  });
}

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
  mockGetRouteById.mockResolvedValue(ROUTE);
  mockUpdateRoute.mockResolvedValue(ROUTE);
});

describe('GET /api/op/routes/[id]', () => {
  it('returns 200 { route } when found', async () => {
    const res = await GET(makeGet('r1'), makeCtx('r1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.route.id).toBe('r1');
  });

  it('returns 404 when route not found (cross-op)', async () => {
    mockGetRouteById.mockResolvedValue(null);
    const res = await GET(makeGet('r-other'), makeCtx('r-other'));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('not_found');
  });
});

describe('PATCH /api/op/routes/[id]', () => {
  it('returns 200 on valid partial update', async () => {
    const res = await PATCH(makePatch('r1', { origin: 'Hải Phòng' }), makeCtx('r1'));
    expect(res.status).toBe(200);
    expect(mockUpdateRoute).toHaveBeenCalledWith(
      expect.objectContaining({ operatorId: 'op-org-1', routeId: 'r1' })
    );
  });

  it('returns 404 when RouteServiceError not_found', async () => {
    mockUpdateRoute.mockRejectedValue(new RouteServiceError('not_found'));
    const res = await PATCH(makePatch('r1', { origin: 'X' }), makeCtx('r1'));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('not_found');
  });

  it('returns 422 reactivation_not_supported for deactivated route', async () => {
    mockUpdateRoute.mockRejectedValue(new RouteServiceError('reactivation_not_supported'));
    const res = await PATCH(makePatch('r1', { origin: 'X' }), makeCtx('r1'));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('reactivation_not_supported');
  });

  it('returns 422 invalid_input on durationMinutes > 7200', async () => {
    const res = await PATCH(makePatch('r1', { durationMinutes: 9999 }), makeCtx('r1'));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('invalid_input');
  });

  it('returns 400 bad_request on malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/op/routes/r1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: 'bb_op_access=valid-token' },
      body: 'bad',
    });
    const res = await PATCH(req, makeCtx('r1'));
    expect(res.status).toBe(400);
  });
});
