/**
 * requireAdminAuth — HOF that guards admin API routes (Issue 054).
 *
 * Mirrors requireOperatorAuth.ts but operates on the admin realm:
 *   - reads the bb_admin_access cookie
 *   - verifyAdminAccess (rejects customer/operator-scoped tokens)
 *   - confirms the AdminUser still exists and is status=ACTIVE (rejects DISABLED)
 *   - optionally enforces an allowed-role set (403 FORBIDDEN on mismatch)
 *   - threads ctx { adminId, role, totpVerified } to the wrapped handler
 *
 * Usage:
 *   export const GET = requireAdminAuth()(handler);
 *   export const POST = requireAdminAuth({ role: 'SUPER_ADMIN' })(handler);
 *   export const POST = requireAdminAuth({ role: ['SUPER_ADMIN', 'FINANCE'] })(handler);
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminAccess, type AdminAccessPayload } from './jwt';
import { prisma } from '@/lib/core/db/client';

type AdminRole = AdminAccessPayload['role'];

export const ADMIN_ACCESS_COOKIE = 'bb_admin_access';

export interface RequireAdminAuthOptions {
  /** Restrict the route to one or more admin roles. Omit to allow any ACTIVE admin. */
  role?: AdminRole | AdminRole[];
  /**
   * Issue 055: require the session to have cleared the TOTP step (ctx.totpVerified===true).
   * When true and totpVerified !== true → 403 { error: 'TOTP_REQUIRED' }.
   * Enroll/confirm/verify routes pass requireTotp:false (they RUN the TOTP flow);
   * step-up + Wave-3 finance/approval routes pass requireTotp:true.
   */
  requireTotp?: boolean;
}

/** Context the HOF threads to the wrapped handler. */
export interface AdminAuthContext {
  adminId: string;
  role: AdminRole;
  totpVerified: boolean;
}

type Handler = (req: NextRequest, ctx: AdminAuthContext) => Promise<Response>;
type LegacyHandler = (req: NextRequest) => Promise<Response>;
type AnyHandler = Handler | LegacyHandler;
type HOF = (handler: AnyHandler) => LegacyHandler;

export function requireAdminAuth(options: RequireAdminAuthOptions = {}): HOF {
  const allowedRoles =
    options.role === undefined
      ? null
      : new Set<AdminRole>(Array.isArray(options.role) ? options.role : [options.role]);

  return (handler: AnyHandler): LegacyHandler => {
    return async (req: NextRequest): Promise<Response> => {
      const cookieStore = await cookies();
      const tokenCookie = cookieStore.get(ADMIN_ACCESS_COOKIE);

      if (!tokenCookie?.value) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }

      const payload = await verifyAdminAccess(tokenCookie.value);
      if (!payload) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }

      // Confirm the admin still exists and is ACTIVE — a DISABLED admin's token
      // must stop working before its 600s TTL elapses.
      const admin = await prisma.adminUser.findUnique({
        where: { id: payload.sub },
        select: { id: true, status: true, role: true },
      });

      if (!admin || admin.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }

      // Role gate — use the DB role (authoritative) rather than the JWT claim.
      const role = admin.role as AdminRole;
      if (allowedRoles && !allowedRoles.has(role)) {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
      }

      // TOTP gate (Issue 055) — a session that has not cleared the TOTP step
      // (totpVerified from the JWT claim) is rejected on TOTP-required routes.
      if (options.requireTotp === true && payload.totpVerified !== true) {
        return NextResponse.json({ error: 'TOTP_REQUIRED' }, { status: 403 });
      }

      const ctx: AdminAuthContext = {
        adminId: admin.id,
        role,
        totpVerified: payload.totpVerified,
      };

      return (handler as Handler)(req, ctx);
    };
  };
}
