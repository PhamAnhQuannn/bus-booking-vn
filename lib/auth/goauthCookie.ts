/**
 * bb_goauth cookie — carries the OAuth `state` and PKCE `code_verifier` across the
 * Google redirect, HMAC-signed so the callback can trust it round-tripped
 * untampered. Signed (not encrypted): state/verifier are single-use anti-CSRF/PKCE
 * nonces, not long-lived secrets, but MUST be tamper-evident — a forged state would
 * defeat the CSRF check. Short TTL (10 min) bounds the handshake window.
 *
 * Secret: GOAUTH_COOKIE_SECRET (≥32 chars) — distinct from HOLD_SECRET / JWT_SECRET
 * so an OAuth-cookie key leak is blast-contained to this flow.
 */

import { signValue, unsignValue } from '@/lib/security';

export const GOAUTH_COOKIE_NAME = 'bb_goauth';
/** 10 minutes — the OAuth handshake window. */
export const GOAUTH_COOKIE_MAX_AGE = 600;

export interface GoauthState {
  state: string;
  verifier: string;
  /** Optional post-login redirect target, carried through the handshake because the
   *  registered Google redirect_uri cannot hold a dynamic query param. Validated with
   *  safeReturnTo at the callback before use. */
  returnTo?: string;
}

function getSecret(): string {
  const secret = process.env.GOAUTH_COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('GOAUTH_COOKIE_SECRET must be set and at least 32 characters');
  }
  return secret;
}

/** Serialise a signed bb_goauth cookie value (base64url JSON + HMAC). */
export function buildGoauthCookieValue(data: GoauthState): string {
  const json = JSON.stringify({
    state: data.state,
    verifier: data.verifier,
    ...(data.returnTo !== undefined ? { returnTo: data.returnTo } : {}),
  });
  const b64 = Buffer.from(json, 'utf8').toString('base64url');
  return signValue(b64, getSecret());
}

/** Full Set-Cookie header for bb_goauth. */
export function buildGoauthSetCookieHeader(data: GoauthState): string {
  const value = buildGoauthCookieValue(data);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${GOAUTH_COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Max-Age=${GOAUTH_COOKIE_MAX_AGE}; Path=/${secure}`;
}

/** Clear the bb_goauth cookie (consumed on callback). */
export function buildGoauthClearCookieHeader(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${GOAUTH_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/${secure}`;
}

/** Parse + verify a bb_goauth cookie value. Returns state on success, null otherwise. */
export function readGoauthCookieValue(cookieValue: string): GoauthState | null {
  const b64 = unsignValue(cookieValue, getSecret());
  if (!b64) return null;
  try {
    const json = Buffer.from(b64, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Partial<GoauthState>;
    if (typeof parsed.state !== 'string' || typeof parsed.verifier !== 'string') return null;
    const returnTo = typeof parsed.returnTo === 'string' ? parsed.returnTo : undefined;
    return { state: parsed.state, verifier: parsed.verifier, ...(returnTo !== undefined ? { returnTo } : {}) };
  } catch {
    return null;
  }
}

/** Extract + verify bb_goauth from a Cookie header string. */
export function readGoauthCookie(cookieHeader: string | null): GoauthState | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() === GOAUTH_COOKIE_NAME) {
      return readGoauthCookieValue(trimmed.slice(eq + 1).trim());
    }
  }
  return null;
}
