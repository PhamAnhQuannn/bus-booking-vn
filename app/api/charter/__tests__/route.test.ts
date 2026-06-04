/**
 * Issue 082: unit tests for POST /api/charter (public charter submit).
 * The create service, rate limiter, and optional-auth read are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate, mockLimit, mockGetCustomerOptional } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockLimit: vi.fn(),
  mockGetCustomerOptional: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/charter', () => ({ createCharterRequest: mockCreate }));
vi.mock('@/lib/ratelimit', async (importOriginal) => ({ ...(await importOriginal()), charterRatelimit: { limit: mockLimit } }));
vi.mock('@/lib/auth/requireCustomerAuth', () => ({ getCustomerOptional: mockGetCustomerOptional }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/charter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.9' },
    body: JSON.stringify(body),
  });
}

const VALID = {
  contactName: 'Nguyễn Văn A',
  contactPhone: '0901234567',
  contactEmail: 'a@example.com',
  originName: 'Thanh Hoá',
  destinationNames: ['Sầm Sơn'],
  startDate: '2026-07-01',
  durationDays: 2,
  passengers: 16,
  vehicleType: 'coach',
  notes: 'Đón tại khách sạn',
  company: '', // honeypot empty
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfter: 0 });
  mockGetCustomerOptional.mockResolvedValue(null);
  mockCreate.mockResolvedValue({ ref: 'CH-2026-ABC123', charterId: 'ch_1' });
});

describe('POST /api/charter', () => {
  it('returns 201 with the ref on success', async () => {
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(201);
    expect((await res.json()).ref).toBe('CH-2026-ABC123');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    // startDate is parsed to a Date before the service is called
    expect(mockCreate.mock.calls[0][1].startDate).toBeInstanceOf(Date);
  });

  it('attaches customerId when an optional customer session is present', async () => {
    mockGetCustomerOptional.mockResolvedValue('cust_42');
    await POST(makeRequest(VALID));
    expect(mockCreate.mock.calls[0][1].customerId).toBe('cust_42');
  });

  it('returns 429 when rate limited (service not called)', async () => {
    mockLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 3600 });
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('3600');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('drops a honeypot-filled submission silently with 200 and no create', async () => {
    const res = await POST(makeRequest({ ...VALID, company: 'AcmeBot Inc' }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for a bad body (missing required fields)', async () => {
    const res = await POST(makeRequest({ contactName: '', destinationNames: [], passengers: 0 }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for an unparseable startDate', async () => {
    const res = await POST(makeRequest({ ...VALID, startDate: 'not-a-date' }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
