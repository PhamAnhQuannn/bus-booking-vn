import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockForgotPassword } = vi.hoisted(() => ({
  mockForgotPassword: vi.fn(),
}));

vi.mock('@/lib/account', () => ({ forgotPassword: mockForgotPassword }));
vi.mock('@/lib/withErrorHandler', () => ({
  withErrorHandler: (h: CallableFunction) => h,
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockForgotPassword.mockResolvedValue({});
});

describe('POST /api/auth/forgot-password', () => {
  it('returns 200 ok on valid email', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockForgotPassword).toHaveBeenCalledWith('test@example.com');
  });

  it('returns 200 ok with retryAfter when rate-limited', async () => {
    mockForgotPassword.mockResolvedValue({ retryAfter: 45 });
    const res = await POST(makeRequest({ email: 'test@example.com' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.retryAfter).toBe(45);
  });

  it('returns 200 ok on invalid email format (no enumeration)', async () => {
    const res = await POST(makeRequest({ email: 'bad-email' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockForgotPassword).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID on malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('INVALID');
  });
});
