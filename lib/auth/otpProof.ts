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
import { logger } from '@/lib/logger';

const OTP_PROOF_TTL_SECONDS = 300; // 5 minutes

export type OtpProofPurpose = 'otp_proof' | 'op_pwd_reset' | 'op_login' | 'reset_password' | 'phone_change';

const JTI_REQUIRED_PURPOSES: Set<OtpProofPurpose> = new Set([
  'otp_proof',
  'reset_password',
  'phone_change',
  // P18: a login challenge is exactly the kind of security-sensitive token that must
  // be single-use — the login flow still re-verifies the OTP code, so this adds
  // defense-in-depth for ~zero UX cost (no legitimate client replays a challenge).
  'op_login',
]);

// P18: operator-realm purposes are signed/verified with the OPERATOR secret, not the
// customer access-token secret (JWT_SECRET). Previously all purposes used JWT_SECRET,
// so a customer-realm key compromise could forge operator login/reset proofs.
const OPERATOR_PURPOSES: Set<OtpProofPurpose> = new Set(['op_login', 'op_pwd_reset']);

function getSecretForPurpose(purpose: OtpProofPurpose): Uint8Array {
  const isOperator = OPERATOR_PURPOSES.has(purpose);
  // Distinct test fallbacks per realm ('a' customer / 'b' operator) mirror
  // lib/auth/jwt.ts's REALM_TEST_FALLBACKS so a cross-realm test bug fails loudly.
  const raw =
    (isOperator ? process.env.JWT_OPERATOR_SECRET : process.env.JWT_SECRET) ??
    (process.env.NODE_ENV === 'test' ? (isOperator ? 'b' : 'a').repeat(32) : null);
  if (!raw) throw new Error(`${isOperator ? 'JWT_OPERATOR_SECRET' : 'JWT_SECRET'} not configured`);
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

/**
 * Single-use claim on a jti. Returns true only when THIS call won the claim.
 *
 * FAILS CLOSED — the deliberate opposite of the rate limiter in
 * lib/ratelimit/index.ts, which fails open on the same Upstash outage. That one
 * is a throttle; this one is a replay guard, and "Redis is unreachable" is not
 * evidence a proof is unused. Returning true on error would let an attacker
 * replay an OTP proof or a TOTP code during exactly the network blip that makes
 * them retry.
 *
 * The catch is what makes that posture deliberate rather than accidental. Before
 * it, an Upstash error propagated: verifyOtpProof's outer catch happened to
 * swallow it into a rejection, but verifyLoginTotp (lib/auth/adminTotp.ts) has no
 * catch of its own, so the same blip surfaced as an unhandled 500 on admin TOTP
 * verify — fail-closed by crash, with a stack trace instead of a clean denial.
 */
export async function consumeJti(jti: string, ttlSec: number): Promise<boolean> {
  const provider = process.env.REDIS_PROVIDER;

  try {
    if (provider === 'ioredis') {
      return await consumeJtiViaIoRedis(jti, ttlSec);
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
  } catch (err) {
    // Logged via lib/logger (not console) so the redact list applies. No jti in the
    // line — it is a single-use credential.
    logger.error({ err, provider }, 'auth.consume_jti.failed — fail-closed, denying');
    return false;
  }
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
    .sign(getSecretForPurpose(purpose));
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
    const { payload } = await jwtVerify(token, getSecretForPurpose(purpose), {
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
