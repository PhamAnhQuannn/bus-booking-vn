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
import { issueOtpProof, verifyOtpProof } from '../otpProof';

// In test env, JWT_SECRET is undefined → falls back to 'a'.repeat(32)

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

  it('issues distinct jti per call', async () => {
    const t1 = await issueOtpProof('test@example.com', 'reset_password');
    const t2 = await issueOtpProof('test@example.com', 'reset_password');
    const r1 = await verifyOtpProof(t1, 'reset_password');
    const r2 = await verifyOtpProof(t2, 'reset_password');
    expect(r1!.jti).not.toBe(r2!.jti);
  });
});
