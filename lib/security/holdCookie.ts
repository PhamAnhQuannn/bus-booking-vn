/**
 * HMAC-SHA256 signed cookie utilities for the bb_hold seat-hold cookie.
 *
 * Cookie format:
 *   bb_hold = <holdId>.<expiresAtISO>.<base64url(hmacSHA256(holdId|expiresAtISO))>
 *
 * Flags: HttpOnly, SameSite=Lax, Secure in production, Max-Age=720 (12 min)
 *
 * HMAC key: process.env.HOLD_SECRET (must be ≥32 bytes / 64 hex chars)
 * Verification: crypto.timingSafeEqual (constant-time) to prevent timing attacks
 */

import crypto from 'crypto';

export const COOKIE_NAME = 'bb_hold';
/** 12 minutes in seconds — matches hold TTL */
export const COOKIE_MAX_AGE = 720;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getSecret(): Buffer {
  const hex = process.env.HOLD_SECRET;
  if (!hex || hex.length < 64) {
    throw new Error('HOLD_SECRET must be set and at least 64 hex chars (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

function sign(holdId: string, expiresAtISO: string): string {
  const payload = `${holdId}|${expiresAtISO}`;
  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(payload);
  // base64url (no padding, URL-safe chars)
  return hmac.digest('base64url');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialise a signed bb_hold cookie value.
 * Returns just the value string — caller sets it on the response.
 */
export function buildCookieValue(holdId: string, expiresAtISO: string): string {
  const sig = sign(holdId, expiresAtISO);
  return `${holdId}.${expiresAtISO}.${sig}`;
}

/**
 * Returns the full Set-Cookie header string for bb_hold.
 */
export function buildSetCookieHeader(holdId: string, expiresAtISO: string): string {
  const value = buildCookieValue(holdId, expiresAtISO);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Path=/${secure}`;
}

export interface VerifiedHold {
  holdId: string;
  expiresAtISO: string;
}

/**
 * Parse and verify a bb_hold cookie value.
 * Returns { holdId, expiresAtISO } on success, null on any failure.
 *
 * Uses crypto.timingSafeEqual to prevent timing-based HMAC forgery.
 */
export function verifyCookieValue(cookieValue: string): VerifiedHold | null {
  // Cookie format: <holdId>.<expiresAtISO>.<sig>
  // holdId (cuid) contains no dots. expiresAtISO is an ISO timestamp that DOES contain
  // dots (e.g. ".000Z"). We therefore:
  //   - split on the FIRST dot to extract holdId
  //   - split on the LAST dot to extract sig
  //   - everything in between is expiresAtISO
  const firstDot = cookieValue.indexOf('.');
  if (firstDot === -1) return null;
  const holdId = cookieValue.slice(0, firstDot);

  const lastDot = cookieValue.lastIndexOf('.');
  if (lastDot === firstDot) return null; // no sig segment
  const sig = cookieValue.slice(lastDot + 1);
  const expiresAtISO = cookieValue.slice(firstDot + 1, lastDot);

  if (!holdId || !expiresAtISO || !sig) return null;

  // Compute expected signature
  const expectedSig = sign(holdId, expiresAtISO);

  // Constant-time comparison
  try {
    const sigBuf = Buffer.from(sig, 'base64url');
    const expectedBuf = Buffer.from(expectedSig, 'base64url');
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  return { holdId, expiresAtISO };
}

/**
 * Extract and verify the bb_hold cookie from a Cookie header string.
 * Returns { holdId, expiresAtISO } or null.
 */
export function extractHoldCookie(cookieHeader: string | null): VerifiedHold | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const name = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (name === COOKIE_NAME) {
      return verifyCookieValue(value);
    }
  }
  return null;
}
