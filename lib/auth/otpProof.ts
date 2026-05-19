/**
 * OTP proof JWT utilities.
 *
 * issueOtpProof(phone, purpose) — sign a short-lived HS256 JWT (5min TTL).
 *   Purpose 'otp_proof' — customer OTP verification (register/login flow).
 *   Purpose 'op_pwd_reset' — operator password-reset flow.
 *
 * verifyOtpProof(token, purpose) — verify and return { phone } or null.
 *   Strictly checks the purpose claim to prevent cross-flow proof reuse.
 *
 * Uses JWT_SECRET (reuses the same key as access tokens per plan resolution).
 * No jti/Redis one-shot here — that was a customer auth iteration concern;
 * the op_pwd_reset proof is short-lived (5 min) and the reset route is idempotent
 * for the same hash, so replay risk is acceptable within the TTL window.
 *
 * Rule (Mistake Log 2026-05-18 Issue 007): add the proof field to the top-level
 * logger redact list the same commit it's introduced — already done in logger.ts.
 */

import { SignJWT, jwtVerify } from 'jose';

const OTP_PROOF_TTL_SECONDS = 300; // 5 minutes

export type OtpProofPurpose = 'otp_proof' | 'op_pwd_reset';

function getJwtSecret(): Uint8Array {
  const raw =
    process.env.JWT_SECRET ??
    (process.env.NODE_ENV === 'test' ? 'a'.repeat(32) : null);
  if (!raw) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(raw);
}

/**
 * Issue a short-lived OTP proof JWT.
 */
export async function issueOtpProof(phone: string, purpose: OtpProofPurpose): Promise<string> {
  return new SignJWT({ phone, purpose })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${OTP_PROOF_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

/**
 * Verify an OTP proof JWT.
 * Returns { phone } if valid and purpose matches, null otherwise.
 */
export async function verifyOtpProof(
  token: string,
  purpose: OtpProofPurpose
): Promise<{ phone: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    });
    if (
      typeof payload['phone'] !== 'string' ||
      payload['purpose'] !== purpose
    ) {
      return null;
    }
    return { phone: payload['phone'] as string };
  } catch {
    return null;
  }
}
