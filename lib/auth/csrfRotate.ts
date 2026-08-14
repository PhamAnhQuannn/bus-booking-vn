/**
 * Shared CSRF-rotation helper (#584 / #493) — server-only.
 *
 * Re-mints the bb_csrf double-submit token on an auth-state change (login / logout / OTP-
 * verify) across ALL realms (customer, operator, admin). The token is otherwise minted once
 * (proxy.ts, first safe GET) and never rotated, so a fixed pre-auth value would survive into
 * the authenticated session. Attributes mirror proxy.ts (non-HttpOnly so JS can echo it for
 * the double-submit; session cookie; SameSite=Lax). Extracted from app/api/auth/login/route.ts
 * so every realm rotates identically instead of only the customer/operator login path.
 */

import { generateToken as generateCsrfToken } from './csrf';

export function rotateCsrf(
  cookieStore: Awaited<ReturnType<typeof import('next/headers').cookies>>
): void {
  cookieStore.set('bb_csrf', generateCsrfToken(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}
