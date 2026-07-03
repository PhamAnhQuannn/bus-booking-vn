import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyOtp, mockIssueProof } = vi.hoisted(() => ({
  mockVerifyOtp: vi.fn(),
  mockIssueProof: vi.fn(),
}));

vi.mock('@/lib/account', () => ({ verifyCustomerAccountOtp: mockVerifyOtp }));
vi.mock('@/lib/auth', async (importOriginal) => {
  const { z } = await import('zod');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    ForgotPasswordVerifySchema: z.object({ phone: z.string(), code: z.string() }),
    issueOtpProof: mockIssueProof,
  };
});
vi.mock('@/lib/core/validation/phone', () => ({
  normalizePhone: (p: string) => p.replace(/^0/, '+84'),
}));
vi.mock('@/lib/withErrorHandler', () => ({
  withErrorHandler: (h: CallableFunction) => h,
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/forgot-password/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyOtp.mockResolvedValue({ status: 'ok' });
  mockIssueProof.mockResolvedValue('proof-jwt-token');
});

describe('POST /api/auth/forgot-password/verify', () => {
  it('returns 200 with otpProof on valid OTP', async () => {
    const res = await POST(makeRequest({ phone: '+84901234567', code: '123456' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.otpProof).toBe('proof-jwt-token');
    expect(mockIssueProof).toHaveBeenCalledWith('+84901234567', 'reset_password');
  });

  it('returns 429 OTP_LOCKED_OUT on lockout', async () => {
    mockVerifyOtp.mockResolvedValue({ status: 'locked_out' });
    const res = await POST(makeRequest({ phone: '+84901234567', code: '000000' }));
    const json = await res.json();
    expect(res.status).toBe(429);
    expect(json.error).toBe('OTP_LOCKED_OUT');
  });

  it('returns 400 OTP_EXPIRED when gone', async () => {
    mockVerifyOtp.mockResolvedValue({ status: 'gone' });
    const res = await POST(makeRequest({ phone: '+84901234567', code: '000000' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('OTP_EXPIRED');
  });

  it('returns 400 OTP_INVALID on mismatch', async () => {
    mockVerifyOtp.mockResolvedValue({ status: 'mismatch' });
    const res = await POST(makeRequest({ phone: '+84901234567', code: '000000' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('OTP_INVALID');
  });

  it('returns 400 OTP_INVALID on attempt_cap', async () => {
    mockVerifyOtp.mockResolvedValue({ status: 'attempt_cap' });
    const res = await POST(makeRequest({ phone: '+84901234567', code: '000000' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('OTP_INVALID');
  });

  it('returns 400 INVALID on malformed body', async () => {
    const req = new NextRequest('http://localhost/api/auth/forgot-password/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'bad',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('INVALID');
  });
});
