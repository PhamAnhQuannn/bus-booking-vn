import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const TEST_CID = 'cust-001';
const { mockChangePassword, ChangePasswordError } = vi.hoisted(() => {
  class ChangePasswordError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
      this.name = 'ChangePasswordError';
    }
  }
  return { mockChangePassword: vi.fn(), ChangePasswordError };
});

vi.mock('@/lib/account', () => ({
  changePassword: mockChangePassword,
  ChangePasswordError,
}));
vi.mock('@/lib/auth', () => ({
  requireCustomerAuth:
    () =>
    (handler: CallableFunction) =>
    (req: Request) =>
      handler(req, { customerId: TEST_CID }),
  passwordSchema: z.string().min(8),
}));
vi.mock('@/lib/withErrorHandler', () => ({
  withErrorHandler: (h: CallableFunction) => h,
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/account/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockChangePassword.mockResolvedValue(undefined);
});

describe('POST /api/account/password', () => {
  it('returns 200 ok on success', async () => {
    const res = await POST(makeRequest({ currentPassword: 'OldPass1!', newPassword: 'NewPass1!!' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockChangePassword).toHaveBeenCalledWith(TEST_CID, 'OldPass1!', 'NewPass1!!');
  });

  it('returns 422 CURRENT_PASSWORD_WRONG', async () => {
    mockChangePassword.mockRejectedValue(new ChangePasswordError('CURRENT_PASSWORD_WRONG'));
    const res = await POST(makeRequest({ currentPassword: 'wrong', newPassword: 'NewPass1!!' }));
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.error).toBe('CURRENT_PASSWORD_WRONG');
  });

  it('returns 422 PASSWORD_REUSED', async () => {
    mockChangePassword.mockRejectedValue(new ChangePasswordError('PASSWORD_REUSED'));
    const res = await POST(makeRequest({ currentPassword: 'OldPass1!', newPassword: 'OldPass1!' }));
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.error).toBe('PASSWORD_REUSED');
  });

  it('returns 401 UNAUTHORIZED on CUSTOMER_NOT_FOUND', async () => {
    mockChangePassword.mockRejectedValue(new ChangePasswordError('CUSTOMER_NOT_FOUND'));
    const res = await POST(makeRequest({ currentPassword: 'OldPass1!', newPassword: 'NewPass1!!' }));
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('UNAUTHORIZED');
  });

  it('returns 400 WEAK_PASSWORD on weak newPassword', async () => {
    const res = await POST(makeRequest({ currentPassword: 'OldPass1!', newPassword: 'short' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('WEAK_PASSWORD');
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('returns 400 on missing fields', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });
});
