/**
 * OTP proof JWT utilities.
 *
 * issueOtpProof(phone, purpose) — sign a short-lived HS256 JWT (5min TTL).
 *   Purposes:
 *     'otp_proof'       — customer OTP verification (register/login flow).
 *     'op_pwd_reset'    — operator password-reset flow.
 *     'reset_password'  — customer forgot-password reset flow (Issue 008).
 *     'phone_change'    — customer phone-change OTP flow (Issue 008).
 *
 * verifyOtpProof(token, purpose) — verify and return { phone, jti } or null.
 *   For 'reset_password' and 'phone_change' purposes, a Redis SETNX one-shot
 *   consume is enforced to prevent replay within the TTL window.
 *   For 'op_pwd_reset', the proof is short-lived (5 min) and replay risk is
 *   acceptable within the TTL (reset is idempotent for the same hash).
 *
 * Rule (Mistake Log 2026-05-18 Issue 007): add the proof field to the top-level
 * logger redact list the same commit it's introduced — already done in logger.ts.
 */

import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

const OTP_PROOF_TTL_SECONDS = 300; // 5 minutes

export type OtpProofPurpose = 'otp_proof' | 'op_pwd_reset' | 'reset_password' | 'phone_change';

/** Purposes that require one-shot jti consumption via Redis SETNX */
const JTI_REQUIRED_PURPOSES: Set<OtpProofPurpose> = new Set([
  'reset_password',
  'phone_change',
]);

function getJwtSecret(): Uint8Array {
  const raw =
    process.env.JWT_SECRET ??
    (process.env.NODE_ENV === 'test' ? 'a'.repeat(32) : null);
  if (!raw) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(raw);
}

// ---------------------------------------------------------------------------
// JTI one-shot store — in-memory (dev/test) or Upstash Redis (prod)
// ---------------------------------------------------------------------------

/** In-memory JTI consumed-set with TTL cleanup. */
const _memConsumed = new Map<string, number>(); // jti -> expiresAt (epoch ms)

function memConsumeJti(jti: string, ttlMs: number): boolean {
  // Prune expired entries opportunistically
  const now = Date.now();
  for (const [k, exp] of _memConsumed.entries()) {
    if (exp <= now) _memConsumed.delete(k);
  }
  if (_memConsumed.has(jti)) return false; // already consumed
  _memConsumed.set(jti, now + ttlMs);
  return true; // consumed successfully (first use)
}

async function consumeJti(jti: string, ttlSec: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    // Production: Upstash Redis SETNX equivalent via set with NX flag
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({ url, token });
    const key = `otpproof:consumed:${jti}`;
    // SET key value NX EX ttlSec — returns 'OK' if set, null if already exists
    const result = await redis.set(key, '1', { nx: true, ex: ttlSec });
    return result === 'OK';
  }

  // Dev/test: in-memory store
  return memConsumeJti(jti, ttlSec * 1000);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Issue a short-lived OTP proof JWT.
 * For 'reset_password' and 'phone_change' purposes, a jti is embedded for
 * one-shot consumption on verify.
 */
export async function issueOtpProof(phone: string, purpose: OtpProofPurpose): Promise<string> {
  const jti = crypto.randomUUID();
  return new SignJWT({ phone, purpose, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${OTP_PROOF_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

/**
 * Verify an OTP proof JWT.
 * Returns { phone, jti } if valid and purpose matches, null otherwise.
 * For 'reset_password' and 'phone_change' purposes, enforces one-shot jti consume.
 */
export async function verifyOtpProof(
  token: string,
  purpose: OtpProofPurpose
): Promise<{ phone: string; jti: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    });
    if (
      typeof payload['phone'] !== 'string' ||
      payload['purpose'] !== purpose ||
      typeof payload['jti'] !== 'string'
    ) {
      return null;
    }

    const phone = payload['phone'] as string;
    const jti = payload['jti'] as string;

    // For customer-facing flows, enforce one-shot jti consumption
    if (JTI_REQUIRED_PURPOSES.has(purpose)) {
      // Compute remaining TTL in seconds for Redis key expiry
      const exp = payload.exp as number | undefined;
      const ttlSec = exp ? Math.max(1, exp - Math.floor(Date.now() / 1000)) : OTP_PROOF_TTL_SECONDS;
      const consumed = await consumeJti(jti, ttlSec);
      if (!consumed) return null; // already consumed — replay attempt
    }

    return { phone, jti };
  } catch {
    return null;
  }
}
