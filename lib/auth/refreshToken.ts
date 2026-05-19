/**
 * Refresh token utilities.
 *
 * Token shape: <base64url(JSON payload)>.<hex-hmac-sha256>
 *
 * Payload fields:
 *   tokenId   — cuid-like unique ID per token (crypto.randomUUID())
 *   family    — UUID grouping tokens from the same session lineage
 *   customerId — owner
 *   iat       — issued-at (unix seconds)
 *   rotation  — monotonically incrementing counter
 *
 * produce(payload) → { token, hash }
 *   token: the cookie value
 *   hash:  SHA-256 hex of the token string (stored in Session.refreshTokenHash)
 *
 * verify(token) → { payload, hash } | null
 *   Verifies HMAC with crypto.timingSafeEqual (constant-time).
 *   Returns null on any failure or malformed input.
 *
 * generateFamily() → crypto.randomUUID()
 *
 * Secret: process.env.REFRESH_TOKEN_SECRET (required in production).
 * Test fallback: 'b'.repeat(32) when NODE_ENV === 'test'.
 */

import crypto from 'crypto';

export interface RefreshPayload {
  tokenId: string;
  family: string;
  customerId: string;
  iat: number;
  rotation: number;
}

export interface ProduceResult {
  token: string;
  hash: string;
}

export interface VerifyResult {
  payload: RefreshPayload;
  hash: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getSecret(): Buffer {
  const raw =
    process.env.REFRESH_TOKEN_SECRET ??
    (process.env.NODE_ENV === 'test' ? 'b'.repeat(32) : null);
  if (!raw) throw new Error('REFRESH_TOKEN_SECRET not configured');
  return Buffer.from(raw, 'utf8');
}

function computeHmac(payloadB64: string, secret: Buffer): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Produce a new refresh token and its stored hash.
 */
export function produce(payload: RefreshPayload): ProduceResult {
  const secret = getSecret();
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = computeHmac(payloadB64, secret);
  const token = `${payloadB64}.${hmac}`;
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * Verify a refresh token.
 * Returns { payload, hash } on success, null on any failure.
 */
export function verify(token: string): VerifyResult | null {
  try {
    if (!token || typeof token !== 'string') return null;

    const dotIdx = token.lastIndexOf('.');
    if (dotIdx === -1) return null;

    const payloadB64 = token.slice(0, dotIdx);
    const hmac = token.slice(dotIdx + 1);

    if (!payloadB64 || !hmac) return null;

    const secret = getSecret();
    const expectedHmac = computeHmac(payloadB64, secret);

    // Constant-time comparison to prevent timing attacks
    const hmacBuf = Buffer.from(hmac, 'hex');
    const expectedBuf = Buffer.from(expectedHmac, 'hex');

    if (hmacBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(hmacBuf, expectedBuf)) return null;

    // HMAC valid — decode payload
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as RefreshPayload;

    // Recompute hash of the full token string
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    return { payload, hash };
  } catch {
    return null;
  }
}

/**
 * Generate a new token family UUID.
 */
export function generateFamily(): string {
  return crypto.randomUUID();
}
