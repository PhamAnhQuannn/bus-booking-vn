/**
 * Issue 076: unit tests for POST /api/op/register (self-serve registration).
 * The registration service + rate limiter are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRegisterOperator, mockLimit } = vi.hoisted(() => ({
  mockRegisterOperator: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/onboarding/registerOperator', async () => {
  const actual = await vi.importActual<typeof import('@/lib/onboarding')>(
    '@/lib/onboarding/registerOperator'
  );
  return { ...actual, registerOperator: mockRegisterOperator };
});
vi.mock('@/lib/ratelimit', async (importOriginal) => ({
  ...(await importOriginal()),
  opRegisterRatelimit: { limit: mockLimit },
}));

import { POST } from '../route';
import { RegisterError } from '@/lib/onboarding';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/op/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.7' },
    body: JSON.stringify(body),
  });
}

const VALID = {
  legalName: 'Cong ty Van tai ABC',
  contactEmail: 'lienhe@abc.vn',
  contactPhone: '0901234567',
  password: 'super-secret-pw',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfter: 0 });
  mockRegisterOperator.mockResolvedValue({
    operatorId: 'op_1',
    operatorUserId: 'opu_1',
    applicationRef: 'OP-2026-AB12CD',
  });
});

describe('POST /api/op/register', () => {
  it('returns 201 with applicationRef on success', async () => {
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.applicationRef).toBe('OP-2026-AB12CD');
    expect(mockRegisterOperator).toHaveBeenCalledTimes(1);
  });

  it('returns 429 when rate limited', async () => {
    mockLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 1800 });
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('1800');
    expect(mockRegisterOperator).not.toHaveBeenCalled();
  });

  it('returns 409 PHONE_IN_USE when the phone is already registered', async () => {
    mockRegisterOperator.mockRejectedValue(new RegisterError('phone_in_use'));
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('PHONE_IN_USE');
  });

  it('returns 400 for a bad body (missing fields)', async () => {
    const res = await POST(makeRequest({ legalName: '', contactEmail: 'nope', contactPhone: '', password: 'short' }));
    expect(res.status).toBe(400);
    expect(mockRegisterOperator).not.toHaveBeenCalled();
  });

  it('returns 400 for a too-short password', async () => {
    const res = await POST(makeRequest({ ...VALID, password: '1234567' }));
    expect(res.status).toBe(400);
  });
});
