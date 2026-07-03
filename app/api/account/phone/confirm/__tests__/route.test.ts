import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const TEST_CID = 'cust-001';
const { mockVerifyOtp, mockChangePhone, ChangePhoneError } = vi.hoisted(() => {
  class ChangePhoneError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
      this.name = 'ChangePhoneError';
    }
  }
  return {
    mockVerifyOtp: vi.fn(),
    mockChangePhone: vi.fn(),
    ChangePhoneError,
  };
});

vi.mock('@/lib/account', () => ({
  verifyCustomerAccountOtp: mockVerifyOtp,
  changePhone: mockChangePhone,
  ChangePhoneError,
}));
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
  return new NextRequest('http://localhost/api/account/phone/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyOtp.mockResolvedValue({ status: 'ok' });
  mockChangePhone.mockResolvedValue({ phone: '+84909999999' });
});

describe('POST /api/account/phone/confirm', () => {
  it('returns 200 with phone on success', async () => {
    const res = await POST(makeRequest({ newPhone: '+84909999999', code: '123456' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.phone).toBe('+84909999999');
    expect(mockChangePhone).toHaveBeenCalledWith(TEST_CID, '+84909999999');
  });

  it('returns 429 OTP_LOCKED_OUT', async () => {
    mockVerifyOtp.mockResolvedValue({ status: 'locked_out' });
    const res = await POST(makeRequest({ newPhone: '+84909999999', code: '000000' }));
    const json = await res.json();
    expect(res.status).toBe(429);
    expect(json.error).toBe('OTP_LOCKED_OUT');
    expect(mockChangePhone).not.toHaveBeenCalled();
  });

  it('returns 400 OTP_EXPIRED', async () => {
    mockVerifyOtp.mockResolvedValue({ status: 'gone' });
    const res = await POST(makeRequest({ newPhone: '+84909999999', code: '000000' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('OTP_EXPIRED');
  });

  it('returns 400 OTP_INVALID on mismatch', async () => {
    mockVerifyOtp.mockResolvedValue({ status: 'mismatch' });
    const res = await POST(makeRequest({ newPhone: '+84909999999', code: '000000' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('OTP_INVALID');
  });

  it('returns 422 PHONE_TAKEN', async () => {
    mockChangePhone.mockRejectedValue(new ChangePhoneError('PHONE_TAKEN'));
    const res = await POST(makeRequest({ newPhone: '+84909999999', code: '123456' }));
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.error).toBe('PHONE_TAKEN');
  });

  it('returns 401 UNAUTHORIZED on CUSTOMER_NOT_FOUND', async () => {
    mockChangePhone.mockRejectedValue(new ChangePhoneError('CUSTOMER_NOT_FOUND'));
    const res = await POST(makeRequest({ newPhone: '+84909999999', code: '123456' }));
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('UNAUTHORIZED');
  });

  it('returns 400 INVALID on bad body', async () => {
    const res = await POST(makeRequest({ newPhone: 'bad' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID');
  });
});
