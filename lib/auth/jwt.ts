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

export interface OperatorAccessPayload {
  sub: string;
  scope: 'operator';
  /** Issue 016: operator role claim — 'admin' | 'staff'. Encoded in JWT for Edge-runtime read. */
  role: 'admin' | 'staff';
  requiresPasswordChange: boolean;
  /** Operator org id (Issue 011) — encoded in JWT for Edge-runtime read. */
  operatorId: string;
}

/**
 * Issue 054: Admin realm access payload (THIRD auth realm).
 * `scope: 'admin'` is the realm discriminant; `role` is the admin RBAC role;
 * `totpVerified` reflects whether the session cleared the TOTP step (issue 055+).
 */
export interface AdminAccessPayload {
  sub: string;
  scope: 'admin';
  role: 'SUPER_ADMIN' | 'FINANCE' | 'SUPPORT';
  totpVerified: boolean;
}

// Admin access tokens are deliberately SHORTER-lived than operator (900s) /
// customer tokens — the admin realm is the highest-privilege surface, so a
// stolen access token has a smaller blast-radius window.
const ADMIN_ACCESS_TTL_SECONDS = 600; // 10 minutes

const ADMIN_ROLES = new Set<AdminAccessPayload['role']>(['SUPER_ADMIN', 'FINANCE', 'SUPPORT']);

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
 * Verify a customer access token.
 * Returns { sub, role } on success, null on any failure (expired, tampered, missing).
 * Also rejects tokens that carry scope='operator' (INVALID_SCOPE guard).
 */
export async function verifyAccess(token: string): Promise<AccessPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    const sub = payload.sub;
    const role = payload['role'];
    const scope = payload['scope'];
    // Reject operator- AND admin-scoped tokens from customer HOF (scope
    // cross-contamination guard — Issue 054 added the 'admin' realm).
    if (scope === 'operator' || scope === 'admin') return null;
    if (typeof sub !== 'string' || role !== 'customer') return null;
    return { sub, role: 'customer' };
  } catch {
    return null;
  }
}

/**
 * Sign an operator access token.
 * Returns a compact HS256 JWT with exp = now + 900 s, scope='operator',
 * and requiresPasswordChange claim.
 * The requiresPasswordChange claim enables proxy.ts to enforce the forced-redirect
 * without a DB call. The JWT is rotated on password-change, so stale-claim risk
 * is bounded by the 15-min access-token TTL.
 */
export async function signOperatorAccess(payload: OperatorAccessPayload): Promise<string> {
  const secret = getSecret();
  return new SignJWT({
    scope: payload.scope,
    // Issue 016: role claim — defensive: falls back to 'admin' if not provided (one-release grace for old sessions).
    role: payload.role ?? 'admin',
    requiresPasswordChange: payload.requiresPasswordChange,
    operatorId: payload.operatorId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secret);
}

/**
 * Verify an operator access token.
 * Returns { sub, scope, requiresPasswordChange } on success, null on any failure.
 * Rejects customer-scoped tokens (INVALID_SCOPE guard).
 */
export async function verifyOperatorAccess(token: string): Promise<OperatorAccessPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    const sub = payload.sub;
    const scope = payload['scope'];
    // Cross-realm guard: requiring scope==='operator' rejects both customer
    // (scope absent) and admin (scope==='admin', Issue 054) tokens here.
    if (typeof sub !== 'string' || scope !== 'operator') return null;
    const operatorId = payload['operatorId'];
    // Issue 011: tokens without operatorId claim are stale — force re-login.
    if (typeof operatorId !== 'string' || operatorId.length === 0) return null;
    const requiresPasswordChange = payload['requiresPasswordChange'] === true;
    // Issue 016: role claim — defensive fallback to 'admin' for tokens minted before this release.
    const rawRole = payload['role'];
    const role: 'admin' | 'staff' = rawRole === 'staff' ? 'staff' : 'admin';
    return { sub, scope: 'operator', role, requiresPasswordChange, operatorId };
  } catch {
    return null;
  }
}

/**
 * Issue 054: Sign an admin access token.
 * Returns a compact HS256 JWT with exp = now + 600 s, scope='admin', and the
 * role + totpVerified claims. role/totpVerified are read by requireAdminAuth /
 * Edge middleware without a DB call.
 */
export async function signAdminAccess(payload: AdminAccessPayload): Promise<string> {
  const secret = getSecret();
  return new SignJWT({
    scope: payload.scope,
    role: payload.role,
    totpVerified: payload.totpVerified,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_ACCESS_TTL_SECONDS}s`)
    .sign(secret);
}

/**
 * Issue 054: Verify an admin access token.
 * Returns { sub, scope, role, totpVerified } on success, null on any failure.
 * Cross-realm guard: requires scope==='admin', so customer (scope absent) and
 * operator (scope==='operator') tokens are both rejected here. role must be one
 * of the three admin roles; totpVerified is read strictly as === true.
 */
export async function verifyAdminAccess(token: string): Promise<AdminAccessPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    const sub = payload.sub;
    const scope = payload['scope'];
    if (typeof sub !== 'string' || scope !== 'admin') return null;
    const rawRole = payload['role'];
    if (typeof rawRole !== 'string' || !ADMIN_ROLES.has(rawRole as AdminAccessPayload['role'])) {
      return null;
    }
    const role = rawRole as AdminAccessPayload['role'];
    const totpVerified = payload['totpVerified'] === true;
    return { sub, scope: 'admin', role, totpVerified };
  } catch {
    return null;
  }
}
