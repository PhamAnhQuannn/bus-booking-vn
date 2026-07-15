import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOtpProof,
  mockVerifyOperatorLoginOtp,
  mockOperatorLoginStep2,
  AuthServiceError,
  mockCookieStore,
  mockPrisma,
} = vi.hoisted(() => {
  class AuthServiceError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
      this.name = 'AuthServiceError';
    }
  }
  return {
    mockVerifyOtpProof: vi.fn(),
    mockVerifyOperatorLoginOtp: vi.fn(),
    mockOperatorLoginStep2: vi.fn(),
    AuthServiceError,
    mockCookieStore: { set: vi.fn(), get: vi.fn(), has: vi.fn(), delete: vi.fn() },
    mockPrisma: {
      operatorUser: { findUnique: vi.fn() },
    },
  };
});

vi.mock('@/lib/auth', () => ({
  verifyOtpProof: mockVerifyOtpProof,
  verifyOperatorLoginOtp: mockVerifyOperatorLoginOtp,
  operatorLoginStep2: mockOperatorLoginStep2,
  AuthServiceError,
}));

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

vi.mock('@/lib/core/db/client', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/withErrorHandler', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withErrorHandler: (fn: any) => fn,
}));

import { POST } from '../../verify-otp/route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/login/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { loginChallenge: 'jwt-token-here', code: '123456' };
const PROOF = { email: 'op-user-id-1', phone: 'op-user-id-1', purpose: 'op_login' };
const STEP2_RESULT = {
  otpRequired: false as const,
  accessToken: 'access-tok',
  refreshToken: 'refresh-tok',
  refreshHash: 'hash',
  operator: { id: 'op-1', username: 'PB-0001', displayName: 'Op', requiresPasswordChange: false },
  requiresPasswordChange: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyOtpProof.mockResolvedValue(PROOF);
  mockPrisma.operatorUser.findUnique.mockResolvedValue({ email: 'op@example.com' });
  mockVerifyOperatorLoginOtp.mockResolvedValue({ status: 'ok' });
  mockOperatorLoginStep2.mockResolvedValue(STEP2_RESULT);
});

describe('POST /api/auth/login/verify-otp', () => {
  it('returns 200 with accessToken and sets cookies on valid OTP', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.accessToken).toBe('access-tok');
    expect(json.operator).toBeDefined();
    const cookieNames = mockCookieStore.set.mock.calls.map((c: string[]) => c[0]);
    expect(cookieNames).toContain('bb_op_access');
    expect(cookieNames).toContain('bb_op_refresh');
  });

  it('returns 400 for invalid challenge JWT', async () => {
    mockVerifyOtpProof.mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('invalid_challenge');
  });

  it('returns 400 when proof has no email (operatorUserId)', async () => {
    mockVerifyOtpProof.mockResolvedValue({ ...PROOF, email: '' });

    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('invalid_challenge');
  });

  it('returns 400 when operator user not found', async () => {
    mockPrisma.operatorUser.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(400);
  });

  it('returns 400 on wrong OTP code (mismatch)', async () => {
    mockVerifyOperatorLoginOtp.mockResolvedValue({ status: 'mismatch' });

    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('invalid_code');
  });

  it('returns 400 on expired OTP (gone)', async () => {
    mockVerifyOperatorLoginOtp.mockResolvedValue({ status: 'gone' });

    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('expired');
  });

  it('returns 429 when OTP is locked out', async () => {
    mockVerifyOperatorLoginOtp.mockResolvedValue({ status: 'locked_out' });

    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe('OTP_LOCKED_OUT');
  });

  it('returns 400 for invalid body (missing code)', async () => {
    const res = await POST(makeRequest({ loginChallenge: 'tok' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 for non-JSON body', async () => {
    const req = new NextRequest('http://localhost/api/auth/login/verify-otp', {
      method: 'POST',
      body: 'not json',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 401 when operatorLoginStep2 throws INVALID_CREDENTIALS', async () => {
    mockOperatorLoginStep2.mockRejectedValue(new AuthServiceError('INVALID_CREDENTIALS'));

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
  });

  it('does NOT set cookies on invalid OTP', async () => {
    mockVerifyOperatorLoginOtp.mockResolvedValue({ status: 'mismatch' });

    await POST(makeRequest(VALID_BODY));

    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });
});
