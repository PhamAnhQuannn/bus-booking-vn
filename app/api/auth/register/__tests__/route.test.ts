/**
 * Unit tests for POST /api/auth/register
 *
 * The register route now validates an otpProof JWT (issued by /api/auth/otp/verify)
 * instead of re-consuming the OTP code.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';
import crypto from 'crypto';

const { mockRegister, mockCookieStore, AuthServiceError } = vi.hoisted(() => {
  class AuthServiceError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
      this.name = 'AuthServiceError';
    }
  }
  const mockCookieStore = { set: vi.fn(), get: vi.fn(), has: vi.fn(), delete: vi.fn() };
  return {
    mockRegister: vi.fn(),
    mockCookieStore,
    AuthServiceError,
  };
});

vi.mock('@/lib/auth/authService', () => ({
  register: mockRegister,
  AuthServiceError,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

// Use test JWT secret matching the route's fallback for NODE_ENV=test
const TEST_JWT_SECRET = new TextEncoder().encode('a'.repeat(32));
const TEST_EMAIL = 'test@example.com';

async function makeOtpProof(
  email = TEST_EMAIL,
  expiresInSeconds = 300,
  jti: string = crypto.randomUUID()
): Promise<string> {
  return new SignJWT({ email, purpose: 'otp_proof', jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(TEST_JWT_SECRET);
}

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const AUTH_RESULT = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  refreshHash: 'hash',
  csrf: 'csrf',
  customer: { id: 'cust-1', email: TEST_EMAIL, displayName: 'Test User' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRegister.mockResolvedValue(AUTH_RESULT);
});

describe('POST /api/auth/register', () => {
  it('returns 200 with accessToken and customer on success', async () => {
    const otpProof = await makeOtpProof();
    const body = { email: TEST_EMAIL, otpProof, password: 'Password1' };
    const res = await POST(makeRequest(body));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.accessToken).toBe('access-token');
    expect(json.customer.id).toBe('cust-1');
  });

  it('sets bb_rt cookie on success', async () => {
    const otpProof = await makeOtpProof();
    await POST(makeRequest({ email: TEST_EMAIL, otpProof, password: 'Password1' }));
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'bb_rt',
      'refresh-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' })
    );
  });

  it('returns 400 otp_proof_invalid when otpProof JWT is expired', async () => {
    // -1s expiry → already expired
    const expiredProof = await makeOtpProof(TEST_EMAIL, -1);
    const res = await POST(makeRequest({ email: TEST_EMAIL, otpProof: expiredProof, password: 'Password1' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('otp_proof_invalid');
  });

  it('returns 400 otp_proof_invalid when otpProof email does not match request email', async () => {
    const wrongEmailProof = await makeOtpProof('other@example.com');
    const res = await POST(makeRequest({ email: TEST_EMAIL, otpProof: wrongEmailProof, password: 'Password1' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('otp_proof_invalid');
  });

  it('rejects a replayed otpProof (one-shot jti consume) — 2nd use returns 400', async () => {
    // Same proof (same jti) used twice: first registration succeeds, replay is rejected.
    const otpProof = await makeOtpProof(TEST_EMAIL, 300, 'fixed-replay-jti');
    const first = await POST(makeRequest({ email: TEST_EMAIL, otpProof, password: 'Password1' }));
    expect(first.status).toBe(200);

    const second = await POST(makeRequest({ email: TEST_EMAIL, otpProof, password: 'Password1' }));
    const json = await second.json();
    expect(second.status).toBe(400);
    expect(json.error).toBe('otp_proof_invalid');
  });

  it('returns 400 otp_proof_invalid when otpProof is malformed', async () => {
    const res = await POST(makeRequest({ email: TEST_EMAIL, otpProof: 'not.a.jwt', password: 'Password1' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('otp_proof_invalid');
  });

  it('returns 409 without revealing email existence on EMAIL_TAKEN', async () => {
    mockRegister.mockRejectedValue(new AuthServiceError('EMAIL_TAKEN'));
    const otpProof = await makeOtpProof();
    const res = await POST(makeRequest({ email: TEST_EMAIL, otpProof, password: 'Password1' }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBe('invalid_credentials');
    // Must not mention "email" or "taken" in body
    const text = JSON.stringify(json);
    expect(text).not.toContain('taken');
  });

  it('returns 400 for invalid body (missing otpProof)', async () => {
    const res = await POST(makeRequest({ email: TEST_EMAIL, password: 'Password1' }));
    expect(res.status).toBe(400);
  });
});
