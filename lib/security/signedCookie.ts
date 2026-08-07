/**
 * Generic HMAC-SHA256 signed-value codec — the reusable primitive behind app
 * cookies whose payload must be tamper-evident but not secret (e.g. the OAuth
 * state + PKCE verifier in bb_goauth). Format: `<value>.<base64url(hmacSHA256(value))>`.
 *
 * Verification uses crypto.timingSafeEqual (constant-time) to prevent signature
 * forgery via timing. `holdCookie.ts` predates this and keeps its own inline copy
 * (its value carries structured `holdId|expiresAtISO` fields signed together); this
 * module is the generic primitive new signed cookies build on.
 */

import crypto from 'crypto';

function computeSig(value: string, secret: crypto.BinaryLike): string {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

/** Append an HMAC signature to an arbitrary value. Returns `<value>.<sig>`. */
export function signValue(value: string, secret: crypto.BinaryLike): string {
  return `${value}.${computeSig(value, secret)}`;
}

/**
 * Verify and strip a signature. Returns the original value, or null on any
 * tamper / malformed input. Splits on the LAST dot so the value itself may
 * contain dots.
 */
export function unsignValue(signed: string, secret: crypto.BinaryLike): string | null {
  const lastDot = signed.lastIndexOf('.');
  if (lastDot <= 0) return null; // no value or no sig segment
  const value = signed.slice(0, lastDot);
  const sig = signed.slice(lastDot + 1);
  if (!sig) return null;

  const expected = computeSig(value, secret);
  try {
    const sigBuf = Buffer.from(sig, 'base64url');
    const expectedBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }
  return value;
}
