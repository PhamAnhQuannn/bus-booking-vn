/**
 * Unit tests for POST /api/auth/otp/send
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendOtp } = vi.hoisted(() => ({
  mockSendOtp: vi.fn(),
}));

// Route imports `sendOtp` from the @/lib/auth barrel (post-092b sweep), so mock the
// barrel — not the deep @/lib/auth/sendOtp path. A full barrel mock (no importOriginal)
// also blocks the real barrel from loading authService → @/lib/booking → server-only,
// which is unresolvable under vitest.
vi.mock('@/lib/auth', () => ({ sendOtp: mockSendOtp }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/otp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSendOtp.mockResolvedValue({ ok: true });
});

describe('POST /api/auth/otp/send', () => {
  it('returns 200 success on valid phone', async () => {
    const res = await POST(makeRequest({ phone: '0901234567' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockSendOtp).toHaveBeenCalledWith('0901234567');
  });

  it('returns 400 for invalid phone', async () => {
    const res = await POST(makeRequest({ phone: '1234' }));
    expect(res.status).toBe(400);
    expect(mockSendOtp).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'bad-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 429 with retryAfter when rate limited', async () => {
    mockSendOtp.mockResolvedValue({ ok: false, reason: 'rate_limited', retryAfter: 300 });
    const res = await POST(makeRequest({ phone: '0901234567' }));
    const json = await res.json();
    expect(res.status).toBe(429);
    expect(json.error).toBe('rate_limited');
    expect(json.retryAfter).toBe(300);
    expect(res.headers.get('Retry-After')).toBe('300');
  });
});
