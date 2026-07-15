/**
 * OTP proof JWT utilities.
 *
 * issueOtpProof(identifier, purpose) — sign a short-lived HS256 JWT (5min TTL).
 *   Customer flows carry `email`, operator flows carry `phone`.
 *
 * verifyOtpProof(token, purpose) — verify and return { email?, phone?, jti } or null.
 *   One-shot jti consume enforced for customer purposes (replay-safe).
 */

import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import type IORedisType from 'ioredis';

const OTP_PROOF_TTL_SECONDS = 300; // 5 minutes

export type OtpProofPurpose = 'otp_proof' | 'op_pwd_reset' | 'op_login' | 'reset_password' | 'phone_change';

const JTI_REQUIRED_PURPOSES: Set<OtpProofPurpose> = new Set([
  'otp_proof',
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
// JTI one-shot store
// ---------------------------------------------------------------------------

const _memConsumed = new Map<string, number>();

function memConsumeJti(jti: string, ttlMs: number): boolean {
  const now = Date.now();
  for (const [k, exp] of _memConsumed.entries()) {
    if (exp <= now) _memConsumed.delete(k);
  }
  if (_memConsumed.has(jti)) return false;
  _memConsumed.set(jti, now + ttlMs);
  return true;
}

let _jtiRedisPromise: Promise<IORedisType> | null = null;

async function getJtiRedisClient(): Promise<IORedisType> {
  if (_jtiRedisPromise) return _jtiRedisPromise;
  _jtiRedisPromise = (async () => {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const { default: IORedis } = await import('ioredis');
    const redis = new IORedis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    try {
      await redis.connect();
    } catch (err) {
      _jtiRedisPromise = null;
      throw err;
    }
    return redis;
  })();
  return _jtiRedisPromise;
}

async function consumeJtiViaIoRedis(jti: string, ttlSec: number): Promise<boolean> {
  const redis = await getJtiRedisClient();
  const key = `otpproof:consumed:${jti}`;
  try {
    const result = await redis.set(key, '1', 'EX', ttlSec, 'NX');
    return result === 'OK';
  } catch (err) {
    _jtiRedisPromise = null;
    throw err;
  }
}

export async function consumeJti(jti: string, ttlSec: number): Promise<boolean> {
  const provider = process.env.REDIS_PROVIDER;

  if (provider === 'ioredis') {
    return consumeJtiViaIoRedis(jti, ttlSec);
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (provider === 'upstash' || (url && token)) {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({ url: url!, token: token! });
    const key = `otpproof:consumed:${jti}`;
    const result = await redis.set(key, '1', { nx: true, ex: ttlSec });
    return result === 'OK';
  }

  return memConsumeJti(jti, ttlSec * 1000);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface OtpProofPayload {
  email?: string;
  phone?: string;
  jti: string;
}

/**
 * Issue a short-lived OTP proof JWT carrying email (customer flows).
 */
export async function issueOtpProof(identifier: string, purpose: OtpProofPurpose): Promise<string> {
  const jti = crypto.randomUUID();
  const identifierKey = purpose === 'op_pwd_reset' ? 'phone' : 'email';
  return new SignJWT({ [identifierKey]: identifier, purpose, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${OTP_PROOF_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

/**
 * Verify an OTP proof JWT.
 * Returns { email?, phone?, jti } if valid and purpose matches, null otherwise.
 */
export async function verifyOtpProof(
  token: string,
  purpose: OtpProofPurpose
): Promise<OtpProofPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    });
    if (payload['purpose'] !== purpose || typeof payload['jti'] !== 'string') {
      return null;
    }

    const email = typeof payload['email'] === 'string' ? payload['email'] : undefined;
    const phone = typeof payload['phone'] === 'string' ? payload['phone'] : undefined;

    if (!email && !phone) return null;

    const jti = payload['jti'] as string;

    if (JTI_REQUIRED_PURPOSES.has(purpose)) {
      const exp = payload.exp as number | undefined;
      const ttlSec = exp ? Math.max(1, exp - Math.floor(Date.now() / 1000)) : OTP_PROOF_TTL_SECONDS;
      const consumed = await consumeJti(jti, ttlSec);
      if (!consumed) return null;
    }

    return { email, phone, jti };
  } catch {
    return null;
  }
}
