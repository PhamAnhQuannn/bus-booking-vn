/**
 * JWT utilities — HS256 access tokens via jose.
 *
 * signAccess({ sub, role }) → compact JWT string, exp=900s
 * verifyAccess(token)       → { sub, role } | null (null on any failure)
 *
 * Secret: process.env.JWT_SECRET (required in production).
 * Test fallback: 'a'.repeat(32) when NODE_ENV === 'test'.
 */

import { SignJWT, jwtVerify } from 'jose';

const ACCESS_TTL_SECONDS = 900; // 15 minutes

function getSecret(): Uint8Array {
  const raw =
    process.env.JWT_SECRET ??
    (process.env.NODE_ENV === 'test' ? 'a'.repeat(32) : null);
  if (!raw) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(raw);
}

export interface AccessPayload {
  sub: string;
  role: 'customer';
}

/**
 * Sign an access token.
 * Returns a compact HS256 JWT with exp = now + 900 s.
 */
export async function signAccess(payload: AccessPayload): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secret);
}

/**
 * Verify an access token.
 * Returns { sub, role } on success, null on any failure (expired, tampered, missing).
 */
export async function verifyAccess(token: string): Promise<AccessPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    const sub = payload.sub;
    const role = payload['role'];
    if (typeof sub !== 'string' || role !== 'customer') return null;
    return { sub, role: 'customer' };
  } catch {
    return null;
  }
}
