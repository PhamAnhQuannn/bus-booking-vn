/**
 * Unit tests for lib/auth/otpProof.ts
 *
 * Tests cover:
 * - Purpose enforcement (wrong purpose → null)
 * - Valid proof returns email + jti (customer) or phone + jti (op_pwd_reset)
 * - One-shot jti consumption for reset_password / phone_change purposes
 * - op_pwd_reset does NOT consume jti (replay within TTL is acceptable)
 */

import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { issueOtpProof, verifyOtpProof } from '../otpProof';

// In test env: customer purposes fall back to JWT_SECRET='a'*32, operator purposes
// (op_login/op_pwd_reset) to JWT_OPERATOR_SECRET='b'*32 (P18 realm split).
const CUSTOMER_SECRET = 'a'.repeat(32);
const OPERATOR_SECRET = 'b'.repeat(32);

async function signRaw(secret: string, claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('300s')
    .sign(new TextEncoder().encode(secret));
}

describe('issueOtpProof / verifyOtpProof', () => {
  it('returns { email, jti } for valid otp_proof', async () => {
    const token = await issueOtpProof('test@example.com', 'otp_proof');
    const result = await verifyOtpProof(token, 'otp_proof');
    expect(result).not.toBeNull();
    expect(result!.email).toBe('test@example.com');
    expect(result!.phone).toBeUndefined();
    expect(typeof result!.jti).toBe('string');
  });

  it('returns null when purpose mismatches', async () => {
    const token = await issueOtpProof('test@example.com', 'otp_proof');
    const result = await verifyOtpProof(token, 'op_pwd_reset');
    expect(result).toBeNull();
  });

  it('returns null for malformed token', async () => {
    const result = await verifyOtpProof('not-a-jwt', 'otp_proof');
    expect(result).toBeNull();
  });

  it('reset_password proof is one-shot: second verify returns null', async () => {
    const token = await issueOtpProof('test@example.com', 'reset_password');
    const first = await verifyOtpProof(token, 'reset_password');
    expect(first).not.toBeNull();
    expect(first!.email).toBe('test@example.com');
    expect(first!.phone).toBeUndefined();
    const second = await verifyOtpProof(token, 'reset_password');
    expect(second).toBeNull(); // replay blocked
  });

  it('phone_change proof is one-shot: second verify returns null', async () => {
    const token = await issueOtpProof('test@example.com', 'phone_change');
    const first = await verifyOtpProof(token, 'phone_change');
    expect(first).not.toBeNull();
    expect(first!.email).toBe('test@example.com');
    expect(first!.phone).toBeUndefined();
    const second = await verifyOtpProof(token, 'phone_change');
    expect(second).toBeNull(); // replay blocked
  });

  it('op_pwd_reset proof allows replay (no jti gate)', async () => {
    const token = await issueOtpProof('+84901234560', 'op_pwd_reset');
    const first = await verifyOtpProof(token, 'op_pwd_reset');
    expect(first).not.toBeNull();
    expect(first!.phone).toBe('+84901234560');
    expect(first!.email).toBeUndefined();
    // op_pwd_reset does NOT consume jti — but jti is still present in payload
    const second = await verifyOtpProof(token, 'op_pwd_reset');
    expect(second).not.toBeNull(); // replay allowed for operator flow
  });

  it('op_login proof is one-shot: second verify returns null (P18)', async () => {
    const token = await issueOtpProof('op-user-1', 'op_login');
    expect(await verifyOtpProof(token, 'op_login')).not.toBeNull();
    expect(await verifyOtpProof(token, 'op_login')).toBeNull(); // replay blocked
  });

  it('rejects an op_login proof signed with the CUSTOMER secret (P18 realm split)', async () => {
    const token = await signRaw(CUSTOMER_SECRET, { email: 'op-user-1', purpose: 'op_login', jti: 'p18a' });
    expect(await verifyOtpProof(token, 'op_login')).toBeNull();
  });

  it('rejects an op_pwd_reset proof signed with the CUSTOMER secret (P18 realm split)', async () => {
    const token = await signRaw(CUSTOMER_SECRET, { phone: '+84901234560', purpose: 'op_pwd_reset', jti: 'p18b' });
    expect(await verifyOtpProof(token, 'op_pwd_reset')).toBeNull();
  });

  it('rejects a customer otp_proof signed with the OPERATOR secret (P18 realm split)', async () => {
    const token = await signRaw(OPERATOR_SECRET, { email: 'c@x.com', purpose: 'otp_proof', jti: 'p18c' });
    expect(await verifyOtpProof(token, 'otp_proof')).toBeNull();
  });

  it('issues distinct jti per call', async () => {
    const t1 = await issueOtpProof('test@example.com', 'reset_password');
    const t2 = await issueOtpProof('test@example.com', 'reset_password');
    const r1 = await verifyOtpProof(t1, 'reset_password');
    const r2 = await verifyOtpProof(t2, 'reset_password');
    expect(r1!.jti).not.toBe(r2!.jti);
  });
});
