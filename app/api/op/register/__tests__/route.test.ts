/**
 * Unit tests for POST /api/op/register (Issue 076; reworked 2026-06-06).
 * Application-only: no password, no account. The registration service + rate
 * limiter are mocked.
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
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/op/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.7' },
    body: JSON.stringify(body),
  });
}

const VALID = {
  brandName: 'Nha Xe ABC',
  legalName: 'Cong ty Van tai ABC',
  contactName: 'Nguyen Van A',
  contactPhone: '0901234567',
  contactEmail: 'lienhe@abc.vn',
  address: 'Ha Noi',
  routesSummary: 'Ha Noi - Sai Gon',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfter: 0 });
  mockRegisterOperator.mockResolvedValue({
    operatorId: 'op_1',
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
    // No password is ever forwarded to the service.
    expect(mockRegisterOperator.mock.calls[0][1]).not.toHaveProperty('password');
  });

  it('returns 429 when rate limited', async () => {
    mockLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 1800 });
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('1800');
    expect(mockRegisterOperator).not.toHaveBeenCalled();
  });

  it('returns 400 for a bad body (missing fields)', async () => {
    const res = await POST(makeRequest({ brandName: '', contactEmail: 'nope' }));
    expect(res.status).toBe(400);
    expect(mockRegisterOperator).not.toHaveBeenCalled();
  });

  it('returns 400 when an application field is missing', async () => {
    const { routesSummary: _omit, ...missing } = VALID;
    const res = await POST(makeRequest(missing));
    expect(res.status).toBe(400);
    expect(mockRegisterOperator).not.toHaveBeenCalled();
  });
});
