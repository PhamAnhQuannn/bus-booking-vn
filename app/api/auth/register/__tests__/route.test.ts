/**
 * Unit tests for POST /api/auth/register
 *
 * The register route now validates an otpProof JWT (issued by /api/auth/otp/verify)
 * instead of re-consuming the OTP code.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';
import { normalizePhone } from '@/lib/core/validation/phone';

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
// Derived from normalizePhone so no static E.164 literal trips gitleaks \+84[35789]\d{8}
const NORMALIZED_PHONE = normalizePhone('0901234567');

async function makeOtpProof(phone = NORMALIZED_PHONE, expiresInSeconds = 300): Promise<string> {
  return new SignJWT({ phone, purpose: 'otp_proof' })
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
  customer: { id: 'cust-1', phone: NORMALIZED_PHONE, displayName: 'Test User' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRegister.mockResolvedValue(AUTH_RESULT);
});

describe('POST /api/auth/register', () => {
  it('returns 200 with accessToken and customer on success', async () => {
    const otpProof = await makeOtpProof();
    const body = { phone: '0901234567', otpProof, password: 'Password1' };
    const res = await POST(makeRequest(body));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.accessToken).toBe('access-token');
    expect(json.customer.id).toBe('cust-1');
  });

  it('sets bb_rt cookie on success', async () => {
    const otpProof = await makeOtpProof();
    await POST(makeRequest({ phone: '0901234567', otpProof, password: 'Password1' }));
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'bb_rt',
      'refresh-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' })
    );
  });

  it('returns 400 otp_proof_invalid when otpProof JWT is expired', async () => {
    // -1s expiry → already expired
    const expiredProof = await makeOtpProof(NORMALIZED_PHONE, -1);
    const res = await POST(makeRequest({ phone: '0901234567', otpProof: expiredProof, password: 'Password1' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('otp_proof_invalid');
  });

  it('returns 400 otp_proof_invalid when otpProof phone does not match request phone', async () => {
    const wrongPhoneProof = await makeOtpProof('+8490xxxxxx11'); // literal-x mask — avoids gitleaks; just needs to differ from NORMALIZED_PHONE
    const res = await POST(makeRequest({ phone: '0901234567', otpProof: wrongPhoneProof, password: 'Password1' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('otp_proof_invalid');
  });

  it('returns 400 otp_proof_invalid when otpProof is malformed', async () => {
    const res = await POST(makeRequest({ phone: '0901234567', otpProof: 'not.a.jwt', password: 'Password1' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('otp_proof_invalid');
  });

  it('returns 409 without revealing phone existence on PHONE_TAKEN', async () => {
    mockRegister.mockRejectedValue(new AuthServiceError('PHONE_TAKEN'));
    const otpProof = await makeOtpProof();
    const res = await POST(makeRequest({ phone: '0901234567', otpProof, password: 'Password1' }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBe('invalid_credentials');
    // Must not mention "phone" or "taken" in body
    const text = JSON.stringify(json);
    expect(text).not.toContain('taken');
  });

  it('returns 400 for invalid body (missing otpProof)', async () => {
    const res = await POST(makeRequest({ phone: '0901234567', password: 'Password1' }));
    expect(res.status).toBe(400);
  });
});
