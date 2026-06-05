/**
 * requireAdminPage — server-only RSC guard for /admin console pages (Issue 064).
 *
 * The Layer 1.5 middleware (Issue 056, proxy.ts) already redirects unauthenticated,
 * cross-realm, and non-TOTP requests to /admin/login BEFORE the page renders. This
 * helper is DEFENSE-IN-DEPTH for the React Server Component layer: it re-reads the
 * bb_admin_access cookie in-process (NEVER self-fetches — AGENTS.md Issue 002/003)
 * and returns the admin ctx (role) the page needs to render role-aware slices.
 *
 * Mirrors requireAdminAuth.ts (the API-route HOF) but for RSCs:
 *   - reads bb_admin_access via cookies() (next/headers)
 *   - verifyAdminAccess (rejects customer/operator-scoped tokens, validates role)
 *   - missing / invalid / totpVerified=false → redirect('/admin/login')
 *   - returns { adminId, role, totpVerified } on success
 *
 * NOTE: unlike requireAdminAuth this does NOT re-read the AdminUser row for an
 * ACTIVE-status check. The 600s access-token TTL bounds the DISABLED-admin window,
 * and pages call this purely for role-aware RENDERING (read-only). Any mutating
 * admin action goes through an /api/admin/* route guarded by requireAdminAuth,
 * which performs the authoritative ACTIVE check. Keep that split intentional.
 *
 * Server-only by construction: imports next/headers + next/navigation, both of
 * which throw if pulled into a client bundle (same guard posture as
 * lib/op/getOperatorSession.ts — no explicit `server-only` package dependency).
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAdminAccess, type AdminAccessPayload } from './jwt';

// Same cookie name as requireAdminAuth.ADMIN_ACCESS_COOKIE — declared locally
// (not imported) so this RSC guard does NOT pull requireAdminAuth's prisma-client
// import into the server-component graph just to read a constant string.
const ADMIN_ACCESS_COOKIE = 'bb_admin_access';

export interface AdminPageContext {
  adminId: string;
  role: AdminAccessPayload['role'];
  totpVerified: boolean;
}

export async function requireAdminPage(): Promise<AdminPageContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_ACCESS_COOKIE)?.value;

  if (!token) {
    redirect('/admin/login');
  }

  const payload = await verifyAdminAccess(token);
  // Reject absent/invalid tokens AND sessions that have not cleared the TOTP
  // step (totpVerified must be strictly true — the highest-privilege realm).
  if (!payload || payload.totpVerified !== true) {
    redirect('/admin/login');
  }

  return {
    adminId: payload.sub,
    role: payload.role,
    totpVerified: payload.totpVerified,
  };
}
