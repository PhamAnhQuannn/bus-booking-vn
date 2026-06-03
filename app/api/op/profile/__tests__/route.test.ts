/**
 * Unit tests for GET + PATCH /api/op/profile
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockOperatorUpdate,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockOperatorUpdate: vi.fn(),
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('@/lib/auth/jwt', () => ({ verifyOperatorAccess: mockVerifyOperatorAccess }));
vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    operatorUser: {
      findUnique: mockOperatorFindUnique,
      update: mockOperatorUpdate,
    },
  },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { GET, PATCH } from '../route';
import { NextRequest } from 'next/server';

function makeGetRequest(): NextRequest {
  return new NextRequest('http://localhost/api/op/profile', {
    method: 'GET',
    headers: { Cookie: 'bb_op_access=valid-token' },
  });
}

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/op/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: 'bb_op_access=valid-token',
    },
    body: JSON.stringify(body),
  });
}

const OPERATOR = {
  phone: '0901234561', // local format
  contactPhone: '0901234562',
  notificationPhone: '0901234563',
  displayName: 'Op Admin',
  requiresPasswordChange: false,
  disabledAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockImplementation((name: string) => {
    if (name === 'bb_op_access') return { value: 'valid-token' };
    return undefined;
  });
  mockVerifyOperatorAccess.mockResolvedValue({ sub: 'op-1', scope: 'operator', requiresPasswordChange: false, operatorId: 'op-org-1' });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR);
  mockOperatorUpdate.mockResolvedValue({});
});

describe('GET /api/op/profile', () => {
  it('returns 200 with profile fields', async () => {
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.displayName).toBe('Op Admin');
    expect(json.requiresPasswordChange).toBe(false);
  });

  it('returns 401 when no cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when requiresPasswordChange=true', async () => {
    mockOperatorFindUnique.mockResolvedValue({ ...OPERATOR, requiresPasswordChange: true });
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});

describe('PATCH /api/op/profile', () => {
  it('returns 204 on valid update', async () => {
    const res = await PATCH(makePatchRequest({ displayName: 'New Name' }));
    expect(res.status).toBe(204);
    expect(mockOperatorUpdate).toHaveBeenCalled();
  });

  it('returns 409 PHONES_MUST_DIFFER when contact === notification phone', async () => {
    // Same normalized phone for both
    const res = await PATCH(makePatchRequest({
      contactPhone: '0901234563',
      notificationPhone: '0901234563',
    }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBe('PHONES_MUST_DIFFER');
  });

  it('returns 400 INVALID_PHONE for non-VN phone format', async () => {
    const res = await PATCH(makePatchRequest({ contactPhone: '12345' }));
    expect(res.status).toBe(400);
  });

  it('returns 403 when requiresPasswordChange=true', async () => {
    mockOperatorFindUnique.mockResolvedValue({ ...OPERATOR, requiresPasswordChange: true });
    const res = await PATCH(makePatchRequest({ displayName: 'Changed' }));
    expect(res.status).toBe(403);
  });
});
