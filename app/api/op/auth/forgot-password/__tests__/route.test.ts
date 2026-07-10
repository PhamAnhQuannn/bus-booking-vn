/**
 * Unit tests for POST /api/op/auth/forgot-password
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendOtp, mockOperatorFindUnique, mockRatelimit } = vi.hoisted(() => ({
  mockSendOtp: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockRatelimit: { limit: vi.fn() },
}));

vi.mock('@/lib/auth/operatorOtp', () => ({ sendOperatorPasswordResetOtp: mockSendOtp }));
vi.mock('@/lib/core/db/client', () => ({
  prisma: { operatorUser: { findUnique: mockOperatorFindUnique } },
}));
vi.mock('@/lib/ratelimit', async (importOriginal) => ({
  ...(await importOriginal()),
  ratelimit: mockRatelimit,
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/op/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRatelimit.limit.mockResolvedValue({ allowed: true, remaining: 59, retryAfter: 0 });
  mockSendOtp.mockResolvedValue({ ok: true });
  mockOperatorFindUnique.mockResolvedValue({ id: 'op-1', disabledAt: null });
});

describe('POST /api/op/auth/forgot-password', () => {
  it('returns 202 for existing operator phone', async () => {
    const res = await POST(makeRequest({ phone: '0901234567' }));
    expect(res.status).toBe(202);
  });

  it('returns 202 for non-existent phone (no enumeration)', async () => {
    mockOperatorFindUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ phone: '0901234567' }));
    expect(res.status).toBe(202);
    expect(mockSendOtp).not.toHaveBeenCalled();
  });

  it('returns 202 for disabled operator (no enumeration)', async () => {
    mockOperatorFindUnique.mockResolvedValue({ id: 'op-1', disabledAt: new Date() });
    const res = await POST(makeRequest({ phone: '0901234567' }));
    expect(res.status).toBe(202);
    expect(mockSendOtp).not.toHaveBeenCalled();
  });

  it('returns 429 RATE_LIMITED when rate limit exceeded', async () => {
    mockSendOtp.mockResolvedValue({ ok: false, reason: 'rate_limited', retryAfter: 900 });
    const res = await POST(makeRequest({ phone: '0901234567' }));
    const json = await res.json();
    expect(res.status).toBe(429);
    expect(json.error).toBe('RATE_LIMITED');
  });

  it('returns 429 LOCKED_OUT when verify-failure lockout is active', async () => {
    mockSendOtp.mockResolvedValue({ ok: false, reason: 'locked_out', retryAfter: 600 });
    const res = await POST(makeRequest({ phone: '0901234567' }));
    const json = await res.json();
    expect(res.status).toBe(429);
    expect(json.error).toBe('LOCKED_OUT');
    expect(json.retryAfter).toBe(600);
  });

  it('returns 429 when outer IP rate limit exceeded', async () => {
    mockRatelimit.limit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 45 });
    const res = await POST(makeRequest({ phone: '0901234567' }));
    const json = await res.json();
    expect(res.status).toBe(429);
    expect(json.error).toBe('RATE_LIMITED');
    expect(res.headers.get('Retry-After')).toBe('45');
    expect(mockSendOtp).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid phone', async () => {
    const res = await POST(makeRequest({ phone: 'not-a-phone' }));
    expect(res.status).toBe(400);
  });
});
