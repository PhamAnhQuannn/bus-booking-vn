/**
 * Unit tests for POST /api/op/auth/forgot-password/verify
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyOtp, mockIssueProof } = vi.hoisted(() => ({
  mockVerifyOtp: vi.fn(),
  mockIssueProof: vi.fn(),
}));

vi.mock('@/lib/auth/operatorOtp', () => ({ verifyOperatorOtp: mockVerifyOtp }));
vi.mock('@/lib/auth/otpProof', () => ({ issueOtpProof: mockIssueProof }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/op/auth/forgot-password/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyOtp.mockResolvedValue({ status: 'ok' });
  mockIssueProof.mockResolvedValue('proof-jwt');
});

describe('POST /api/op/auth/forgot-password/verify', () => {
  it('returns 200 with otpProof on valid code', async () => {
    const res = await POST(makeRequest({ phone: '0901234567', code: '123456' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.otpProof).toBe('proof-jwt');
    expect(mockIssueProof).toHaveBeenCalledWith(expect.any(String), 'op_pwd_reset');
  });

  it('returns 429 LOCKED_OUT on 3 failed verifications', async () => {
    mockVerifyOtp.mockResolvedValue({ status: 'locked_out' });
    const res = await POST(makeRequest({ phone: '0901234567', code: '000000' }));
    const json = await res.json();
    expect(res.status).toBe(429);
    expect(json.error).toBe('LOCKED_OUT');
  });

  it('returns 400 EXPIRED when OTP not found', async () => {
    mockVerifyOtp.mockResolvedValue({ status: 'gone' });
    const res = await POST(makeRequest({ phone: '0901234567', code: '000000' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('EXPIRED');
  });

  it('returns 400 INVALID_CODE on mismatch', async () => {
    mockVerifyOtp.mockResolvedValue({ status: 'mismatch' });
    const res = await POST(makeRequest({ phone: '0901234567', code: '999999' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID_CODE');
  });

  it('returns 400 for malformed body', async () => {
    const res = await POST(makeRequest({ phone: 'not-phone' }));
    expect(res.status).toBe(400);
  });
});
