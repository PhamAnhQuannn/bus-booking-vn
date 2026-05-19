/**
 * CSRF double-submit token utilities.
 *
 * generateToken() — 32-byte random hex (64 chars)
 * compareTokens(a, b) — constant-time comparison via crypto.timingSafeEqual
 *   Returns false (never throws) when lengths differ.
 */

import crypto from 'crypto';

/**
 * Generate a cryptographically random CSRF token.
 * Returns 64-char lowercase hex string (32 bytes).
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Compare two CSRF tokens in constant time.
 * Returns false if lengths differ (no timing leak on short-circuit).
 */
export function compareTokens(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}
