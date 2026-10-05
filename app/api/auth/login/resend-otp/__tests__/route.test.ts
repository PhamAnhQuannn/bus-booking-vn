import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOtpProof,
  mockIssueOtpProof,
  mockSendOperatorLoginOtp,
  mockResendLimit,
  mockPrisma,
} = vi.hoisted(() => ({
  mockVerifyOtpProof: vi.fn(),
  mockIssueOtpProof: vi.fn(),
  mockSendOperatorLoginOtp: vi.fn(),
  mockResendLimit: vi.fn(),
  mockPrisma: { operatorUser: { findUnique: vi.fn() } },
}));

vi.mock('@/lib/ratelimit', () => ({ opLoginResendOtpRatelimit: { limit: mockResendLimit } }));
vi.mock('@/lib/core/http/clientIp', () => ({ clientIp: () => '1.2.3.4' }));
vi.mock('@/lib/auth', () => ({
  verifyOtpProof: mockVerifyOtpProof,
  issueOtpProof: mockIssueOtpProof,
  sendOperatorLoginOtp: mockSendOperatorLoginOtp,
}));
vi.mock('@/lib/core/db/client', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/withErrorHandler', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withErrorHandler: (fn: any) => fn,
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/login/resend-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALID_BODY = { loginChallenge: 'old-challenge-jwt' };

beforeEach(() => {
  vi.clearAllMocks();
  mockResendLimit.mockResolvedValue({ allowed: true, remaining: 9, retryAfter: 0 });
  mockVerifyOtpProof.mockResolvedValue({ email: 'op-user-id-1', purpose: 'op_login' });
  mockPrisma.operatorUser.findUnique.mockResolvedValue({ email: 'op@example.com', disabledAt: null });
  mockSendOperatorLoginOtp.mockResolvedValue({ ok: true });
  mockIssueOtpProof.mockResolvedValue('fresh-challenge-jwt');
});

describe('POST /api/auth/login/resend-otp', () => {
  it('re-sends OTP and returns a FRESH challenge on success (200)', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.loginChallenge).toBe('fresh-challenge-jwt');
    expect(mockSendOperatorLoginOtp).toHaveBeenCalledWith('op@example.com');
    expect(mockIssueOtpProof).toHaveBeenCalledWith('op-user-id-1', 'op_login');
  });

  it('decodes the challenge WITHOUT consuming + with expiry tolerance (consume:false, clockTolerance)', async () => {
    await POST(makeRequest(VALID_BODY));
    expect(mockVerifyOtpProof).toHaveBeenCalledWith('old-challenge-jwt', 'op_login', {
      consume: false,
      clockTolerance: '10 minutes',
    });
  });

  it('returns 400 invalid_challenge for a disabled operator (no OTP email sent)', async () => {
    mockPrisma.operatorUser.findUnique.mockResolvedValue({ email: 'op@example.com', disabledAt: new Date() });

    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('invalid_challenge');
    expect(mockSendOperatorLoginOtp).not.toHaveBeenCalled();
  });

  it('returns 429 RATE_LIMITED and does no OTP work when the per-IP limiter denies', async () => {
    mockResendLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 42 });

    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe('RATE_LIMITED');
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(mockVerifyOtpProof).not.toHaveBeenCalled();
    expect(mockSendOperatorLoginOtp).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_challenge when the proof is invalid', async () => {
    mockVerifyOtpProof.mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('invalid_challenge');
    expect(mockSendOperatorLoginOtp).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_challenge when the operator no longer exists', async () => {
    mockPrisma.operatorUser.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    expect(mockSendOperatorLoginOtp).not.toHaveBeenCalled();
  });

  it('maps a per-email lockout to 429 OTP_LOCKED_OUT', async () => {
    mockSendOperatorLoginOtp.mockResolvedValue({ ok: false, reason: 'locked_out', retryAfter: 900 });

    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe('OTP_LOCKED_OUT');
    expect(mockIssueOtpProof).not.toHaveBeenCalled();
  });

  it('maps a per-email rate-limit to 429 OTP_RATE_LIMITED', async () => {
    mockSendOperatorLoginOtp.mockResolvedValue({ ok: false, reason: 'rate_limited', retryAfter: 120 });

    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe('OTP_RATE_LIMITED');
  });

  it('returns 400 INVALID for a missing loginChallenge', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 INVALID for a non-JSON body', async () => {
    const res = await POST(makeRequest('not json'));
    expect(res.status).toBe(400);
  });
});
