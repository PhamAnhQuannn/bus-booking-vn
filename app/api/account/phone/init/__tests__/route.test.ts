import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const TEST_CID = 'cust-001';
const { mockSendOtp } = vi.hoisted(() => ({
  mockSendOtp: vi.fn(),
}));

vi.mock('@/lib/account', () => ({ sendCustomerAccountOtp: mockSendOtp }));
vi.mock('@/lib/auth', () => ({
  requireCustomerAuth:
    () =>
    (handler: CallableFunction) =>
    (req: Request) =>
      handler(req, { customerId: TEST_CID }),
  phoneSchema: z.string().regex(/^(\+84|0)[35789][0-9]{8}$/),
}));
vi.mock('@/lib/withErrorHandler', () => ({
  withErrorHandler: (h: CallableFunction) => h,
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/account/phone/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSendOtp.mockResolvedValue({ ok: true });
});

describe('POST /api/account/phone/init', () => {
  it('returns 200 ok on success', async () => {
    const res = await POST(makeRequest({ newPhone: '+84901234567' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockSendOtp).toHaveBeenCalledWith('+84901234567');
  });

  it('returns 429 LOCKED_OUT when locked', async () => {
    mockSendOtp.mockResolvedValue({ ok: false, reason: 'locked_out', retryAfter: 900 });
    const res = await POST(makeRequest({ newPhone: '+84901234567' }));
    const json = await res.json();
    expect(res.status).toBe(429);
    expect(json.error).toBe('LOCKED_OUT');
    expect(json.retryAfter).toBe(900);
  });

  it('returns 429 RATE_LIMITED on other rate limit', async () => {
    mockSendOtp.mockResolvedValue({ ok: false, reason: 'rate_limited', retryAfter: 60 });
    const res = await POST(makeRequest({ newPhone: '+84901234567' }));
    const json = await res.json();
    expect(res.status).toBe(429);
    expect(json.error).toBe('RATE_LIMITED');
    expect(json.retryAfter).toBe(60);
  });

  it('returns 400 INVALID on bad phone', async () => {
    const res = await POST(makeRequest({ newPhone: 'bad' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID');
    expect(mockSendOtp).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID on malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/account/phone/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'bad',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
