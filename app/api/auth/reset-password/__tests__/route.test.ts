import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const { mockResetPassword, ResetPasswordError } = vi.hoisted(() => {
  class ResetPasswordError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
      this.name = 'ResetPasswordError';
    }
  }
  return { mockResetPassword: vi.fn(), ResetPasswordError };
});

vi.mock('@/lib/account', () => ({
  resetPassword: mockResetPassword,
  ResetPasswordError,
}));
vi.mock('@/lib/auth', () => ({
  passwordSchema: z.string().min(8),
}));
vi.mock('@/lib/withErrorHandler', () => ({
  withErrorHandler: (h: CallableFunction) => h,
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResetPassword.mockResolvedValue(undefined);
});

describe('POST /api/auth/reset-password', () => {
  it('returns 204 on success', async () => {
    const res = await POST(makeRequest({ otpProof: 'valid-proof', newPassword: 'StrongPass1!' }));
    expect(res.status).toBe(204);
    expect(mockResetPassword).toHaveBeenCalledWith('valid-proof', 'StrongPass1!');
  });

  it('returns 401 INVALID_PROOF on bad proof', async () => {
    mockResetPassword.mockRejectedValue(new ResetPasswordError('INVALID_PROOF'));
    const res = await POST(makeRequest({ otpProof: 'bad', newPassword: 'StrongPass1!' }));
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('INVALID_PROOF');
  });

  it('returns 401 INVALID_PROOF on CUSTOMER_NOT_FOUND', async () => {
    mockResetPassword.mockRejectedValue(new ResetPasswordError('CUSTOMER_NOT_FOUND'));
    const res = await POST(makeRequest({ otpProof: 'proof', newPassword: 'StrongPass1!' }));
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('INVALID_PROOF');
  });

  it('returns 422 PASSWORD_REUSED', async () => {
    mockResetPassword.mockRejectedValue(new ResetPasswordError('PASSWORD_REUSED'));
    const res = await POST(makeRequest({ otpProof: 'proof', newPassword: 'StrongPass1!' }));
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.error).toBe('PASSWORD_REUSED');
  });

  it('returns 400 WEAK_PASSWORD on weak password', async () => {
    const res = await POST(makeRequest({ otpProof: 'proof', newPassword: 'short' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('WEAK_PASSWORD');
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID on missing otpProof', async () => {
    const res = await POST(makeRequest({ newPassword: 'StrongPass1!' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID');
  });

  it('returns 400 INVALID on malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
