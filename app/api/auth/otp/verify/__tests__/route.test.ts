/**
 * Unit tests for POST /api/auth/otp/verify
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyOtp } = vi.hoisted(() => ({
  mockVerifyOtp: vi.fn(),
}));

vi.mock('@/lib/auth/authService', () => ({ verifyOtp: mockVerifyOtp }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { phone: '0901234567', code: '123456' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/otp/verify', () => {
  it('returns otpProof JWT on success', async () => {
    mockVerifyOtp.mockResolvedValue({ status: 'ok', otpId: 'otp-1' });
    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(typeof json.otpProof).toBe('string');
    expect(json.otpProof.split('.').length).toBe(3); // JWT format
  });

  it('returns 400 expired when OTP is gone', async () => {
    mockVerifyOtp.mockResolvedValue({ status: 'gone' });
    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('expired');
  });

  it('returns 400 invalid when code is wrong', async () => {
    mockVerifyOtp.mockResolvedValue({ status: 'mismatch' });
    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('invalid');
  });

  it('returns 400 for invalid request body', async () => {
    const res = await POST(makeRequest({ phone: '0901234567' })); // missing code
    expect(res.status).toBe(400);
  });
});
