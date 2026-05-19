/**
 * requireOperatorAuth — HOF that guards operator API routes.
 *
 * Options:
 *   allowDuringPasswordChange?: boolean (default false)
 *     When false, routes will return 403 PASSWORD_CHANGE_REQUIRED if the
 *     operator has requiresPasswordChange=true.
 *     Set to true only for /api/op/auth/password/change and /api/op/auth/logout.
 *
 * Usage:
 *   export const GET = requireOperatorAuth({})(handler);
 *   export const POST = requireOperatorAuth({ allowDuringPasswordChange: true })(handler);
 *
 * The wrapped handler receives the original NextRequest — access to the operator
 * context is via the cookie/JWT flow already established.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyOperatorAccess } from './jwt';
import { prisma } from '@/lib/db/client';

const ACCESS_COOKIE = 'bb_op_access';

export interface RequireOperatorAuthOptions {
  /** Allow the wrapped route to run even if requiresPasswordChange=true. Default: false. */
  allowDuringPasswordChange?: boolean;
  /** Issue 017: return 403 FORBIDDEN when the authenticated operator's role !== 'admin'. Default: false. */
  adminOnly?: boolean;
  /**
   * Issue 018: staff-scope guard for trip-scoped routes. When set and the
   * authenticated operator's role === 'staff', the resolver returns the tripId
   * the request targets; the route is admitted only if that tripId equals the
   * staff member's assignedTripId. Any mismatch — a different trip, a trip the
   * resolver can't map (returns null), or a staff member with no assignment
   * (assignedTripId === null) — returns 404, never 403: staff must not learn
   * that other trips exist. Admin callers bypass this guard entirely.
   *
   * The resolver may read the request body or hit the DB (e.g. booking → tripId),
   * so it is async. assignedTripId is read fresh from the DB on every request,
   * so a re-assignment (Issue 017) takes effect on the staff member's next call
   * with no stale-session window.
   */
  staffTripScope?: (ctx: OperatorAuthContext) => string | null | Promise<string | null>;
}

/** Context the HOF threads to the wrapped handler (Issue 011, role added Issue 017, assignedTripId added Issue 018). */
export interface OperatorAuthContext {
  operatorUserId: string;
  operatorId: string;
  role: 'admin' | 'staff';
  assignedTripId: string | null;
}

type Handler = (req: NextRequest, ctx: OperatorAuthContext) => Promise<Response>;
type LegacyHandler = (req: NextRequest) => Promise<Response>;
type AnyHandler = Handler | LegacyHandler;
type HOF = (handler: AnyHandler) => LegacyHandler;

export function requireOperatorAuth(options: RequireOperatorAuthOptions = {}): HOF {
  const { allowDuringPasswordChange = false, adminOnly = false, staffTripScope } = options;

  return (handler: AnyHandler): LegacyHandler => {
    return async (req: NextRequest): Promise<Response> => {
      const cookieStore = await cookies();
      const tokenCookie = cookieStore.get(ACCESS_COOKIE);

      if (!tokenCookie?.value) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }

      const payload = await verifyOperatorAccess(tokenCookie.value);
      if (!payload) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }

      // Look up the operator user
      const operator = await prisma.operatorUser.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          phone: true,
          displayName: true,
          requiresPasswordChange: true,
          disabledAt: true,
          operatorId: true,
          role: true,
          assignedTripId: true,
        },
      });

      if (!operator || operator.disabledAt !== null) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }

      // Forced password change gate
      if (operator.requiresPasswordChange && !allowDuringPasswordChange) {
        return NextResponse.json({ error: 'PASSWORD_CHANGE_REQUIRED' }, { status: 403 });
      }

      // Issue 017: admin-only routes reject staff role
      if (adminOnly && operator.role !== 'admin') {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
      }

      const ctx: OperatorAuthContext = {
        operatorUserId: operator.id,
        operatorId: operator.operatorId,
        role: operator.role,
        assignedTripId: operator.assignedTripId,
      };

      // Issue 018: staff-scope guard. Constrain staff to their assigned trip;
      // any mismatch is a 404 (do not leak the existence of other trips).
      if (staffTripScope && ctx.role === 'staff') {
        if (ctx.assignedTripId === null) {
          return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }
        const targetTripId = await staffTripScope(ctx);
        if (targetTripId === null || targetTripId !== ctx.assignedTripId) {
          return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }
      }

      return (handler as Handler)(req, ctx);
    };
  };
}
