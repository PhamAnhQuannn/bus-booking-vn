/**
 * Unit tests for /api/op/buses (collection routes — Issue 011).
 *
 * Coverage:
 *   GET  — happy path, activeOnly default true, activeOnly=0 includes deactivated.
 *   POST — happy path 201, invalid input 400, plate_in_use 422, no cookie 401.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockBusFindMany,
  mockBusCreate,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockBusFindMany: vi.fn(),
  mockBusCreate: vi.fn(),
  mockCookieStore: { get: vi.fn() },
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    operatorUser: { findUnique: mockOperatorFindUnique },
    bus: { findMany: mockBusFindMany, create: mockBusCreate },
  },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { GET, POST } from '../route';
import { NextRequest } from 'next/server';

function makeGet(activeOnly?: '0' | '1'): NextRequest {
  const url = activeOnly !== undefined
    ? `http://localhost/api/op/buses?activeOnly=${activeOnly}`
    : 'http://localhost/api/op/buses';
  return new NextRequest(url, {
    method: 'GET',
    headers: { Cookie: 'bb_op_access=valid-token' },
  });
}

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/op/buses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: 'bb_op_access=valid-token',
    },
    body: JSON.stringify(body),
  });
}

const OPERATOR_USER = {
  id: 'op-1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: 'op-org-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({
    sub: 'op-1',
    scope: 'operator',
    requiresPasswordChange: false,
    operatorId: 'op-org-1',
  });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_USER);
});

describe('GET /api/op/buses', () => {
  it('returns 200 { buses } scoped to operatorId with activeOnly=true by default', async () => {
    mockBusFindMany.mockResolvedValue([
      { id: 'b1', licensePlate: 'AAA-111', capacity: 30, busType: 'coach', deactivatedAt: null },
    ]);
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.buses).toHaveLength(1);
    // Should pass deactivatedAt: null filter
    expect(mockBusFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ operatorId: 'op-org-1', deactivatedAt: null }),
      })
    );
  });

  it('activeOnly=0 includes deactivated rows', async () => {
    mockBusFindMany.mockResolvedValue([]);
    const res = await GET(makeGet('0'));
    expect(res.status).toBe(200);
    expect(mockBusFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { operatorId: 'op-org-1' },
      })
    );
  });

  it('returns 401 when no cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });
});

describe('POST /api/op/buses', () => {
  it('returns 201 with bus on valid input', async () => {
    mockBusCreate.mockResolvedValue({
      id: 'b-new',
      operatorId: 'op-org-1',
      licensePlate: 'AAA-111',
      capacity: 30,
      busType: 'coach',
    });
    const res = await POST(
      makePost({ licensePlate: 'aaa-111', capacity: 30, busType: 'coach' })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.bus.licensePlate).toBe('AAA-111'); // uppercased by zod
    expect(mockBusCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ operatorId: 'op-org-1' }),
      })
    );
  });

  it('returns 400 invalid_input for capacity out of range', async () => {
    const res = await POST(makePost({ licensePlate: 'AAA-111', capacity: 200, busType: 'coach' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_input');
  });

  it('returns 400 invalid_input for short license plate', async () => {
    const res = await POST(makePost({ licensePlate: 'X', capacity: 30, busType: 'coach' }));
    expect(res.status).toBe(400);
  });

  it('returns 422 plate_in_use on P2002', async () => {
    const { Prisma } = await import('@prisma/client');
    const err = new Prisma.PrismaClientKnownRequestError('unique violation', {
      code: 'P2002',
      clientVersion: 'test',
    });
    mockBusCreate.mockRejectedValue(err);

    const res = await POST(makePost({ licensePlate: 'AAA-111', capacity: 30, busType: 'coach' }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('plate_in_use');
  });

  it('returns 401 when no cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost({ licensePlate: 'AAA-111', capacity: 30, busType: 'coach' }));
    expect(res.status).toBe(401);
  });
});
