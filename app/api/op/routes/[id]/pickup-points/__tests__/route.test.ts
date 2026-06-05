/**
 * Unit tests for /api/op/routes/[id]/pickup-points (Issue 012).
 *
 * Coverage:
 *   GET   — 200 { pickupPoints }, 404 null route
 *   POST  — 201 on create, 422 invalid_input, 422 too_many_pickup_points, 404 cross-op
 *   PATCH — 200 on bulk reorder, 422 unknown/incomplete, 400 bad_request
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockListPickupPoints,
  mockCreatePickupPoint,
  mockBulkReorder,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockListPickupPoints: vi.fn(),
  mockCreatePickupPoint: vi.fn(),
  mockBulkReorder: vi.fn(),
  mockCookieStore: { get: vi.fn() },
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/core/db/client', () => ({
  prisma: { operatorUser: { findUnique: mockOperatorFindUnique } },
}));
vi.mock('@/lib/catalog/listPickupPoints', () => ({ listPickupPoints: mockListPickupPoints }));
vi.mock('@/lib/catalog/createPickupPoint', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/catalog')>();
  return { ...actual, createPickupPoint: mockCreatePickupPoint };
});
vi.mock('@/lib/catalog/bulkReorder', () => ({ bulkReorder: mockBulkReorder }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { GET, POST, PATCH } from '../route';
import { NextRequest } from 'next/server';
import { PickupPointServiceError } from '@/lib/catalog';

const OP_USER = {
  id: 'ou1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: 'op-org-1',
};

// CUID-format IDs required by bulkReorderSchema z.string().cuid()
const PP_ID = 'cjld2cjxh0000qzrmn831i7rn';

const PP = {
  id: PP_ID,
  routeId: 'r1',
  name: 'Bến xe Mỹ Đình',
  address: '20 Phạm Hùng',
  displayOrder: 1,
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeCtx(id = 'r1') {
  return { params: Promise.resolve({ id }) };
}

function makeGet(id = 'r1') {
  return new NextRequest(`http://localhost/api/op/routes/${id}/pickup-points`, {
    method: 'GET',
    headers: { Cookie: 'bb_op_access=valid-token' },
  });
}

function makePost(id = 'r1', body: unknown = {}) {
  return new NextRequest(`http://localhost/api/op/routes/${id}/pickup-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: 'bb_op_access=valid-token' },
    body: JSON.stringify(body),
  });
}

function makePatch(id = 'r1', body: unknown = {}) {
  return new NextRequest(`http://localhost/api/op/routes/${id}/pickup-points`, {
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
  mockListPickupPoints.mockResolvedValue([PP]);
  mockCreatePickupPoint.mockResolvedValue(PP);
  mockBulkReorder.mockResolvedValue([PP]);
});

describe('GET /api/op/routes/[id]/pickup-points', () => {
  it('returns 200 { pickupPoints }', async () => {
    const res = await GET(makeGet('r1'), makeCtx('r1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pickupPoints).toHaveLength(1);
  });

  it('returns 404 when listPickupPoints returns null (cross-op)', async () => {
    mockListPickupPoints.mockResolvedValue(null);
    const res = await GET(makeGet('r-other'), makeCtx('r-other'));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('not_found');
  });
});

describe('POST /api/op/routes/[id]/pickup-points', () => {
  it('returns 201 { pickupPoint } on valid create', async () => {
    const res = await POST(
      makePost('r1', { name: 'Bến xe Mỹ Đình', address: '20 Phạm Hùng' }),
      makeCtx('r1')
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.pickupPoint.name).toBe('Bến xe Mỹ Đình');
  });

  it('returns 422 invalid_input on empty name', async () => {
    const res = await POST(makePost('r1', { name: '', address: 'Addr' }), makeCtx('r1'));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('invalid_input');
  });

  it('returns 404 when createPickupPoint throws not_found (cross-op)', async () => {
    mockCreatePickupPoint.mockRejectedValue(new PickupPointServiceError('not_found'));
    const res = await POST(
      makePost('r-other', { name: 'X', address: 'Y' }),
      makeCtx('r-other')
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('not_found');
  });

  it('returns 422 too_many_pickup_points at capacity', async () => {
    mockCreatePickupPoint.mockRejectedValue(new PickupPointServiceError('too_many_pickup_points'));
    const res = await POST(
      makePost('r1', { name: 'X', address: 'Y' }),
      makeCtx('r1')
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('too_many_pickup_points');
  });
});

describe('PATCH /api/op/routes/[id]/pickup-points (bulk reorder)', () => {
  it('returns 200 { pickupPoints } on valid reorder', async () => {
    const res = await PATCH(
      makePatch('r1', { orderedIds: [PP_ID] }),
      makeCtx('r1')
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pickupPoints).toHaveLength(1);
  });

  it('returns 422 unknown_pickup_points', async () => {
    mockBulkReorder.mockRejectedValue(new PickupPointServiceError('unknown_pickup_points'));
    const res = await PATCH(
      makePatch('r1', { orderedIds: [PP_ID] }),
      makeCtx('r1')
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('unknown_pickup_points');
  });

  it('returns 422 incomplete_reorder when active ids omitted', async () => {
    mockBulkReorder.mockRejectedValue(new PickupPointServiceError('incomplete_reorder'));
    const res = await PATCH(
      makePatch('r1', { orderedIds: [PP_ID] }),
      makeCtx('r1')
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('incomplete_reorder');
  });

  it('returns 422 invalid_input on empty orderedIds array', async () => {
    const res = await PATCH(makePatch('r1', { orderedIds: [] }), makeCtx('r1'));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('invalid_input');
  });

  it('returns 400 bad_request on malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/op/routes/r1/pickup-points', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: 'bb_op_access=valid-token' },
      body: 'bad',
    });
    const res = await PATCH(req, makeCtx('r1'));
    expect(res.status).toBe(400);
  });
});
