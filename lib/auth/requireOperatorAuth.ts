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
}

type Handler = (req: NextRequest) => Promise<Response>;
type HOF = (handler: Handler) => Handler;

export function requireOperatorAuth(options: RequireOperatorAuthOptions = {}): HOF {
  const { allowDuringPasswordChange = false } = options;

  return (handler: Handler): Handler => {
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
        },
      });

      if (!operator || operator.disabledAt !== null) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }

      // Forced password change gate
      if (operator.requiresPasswordChange && !allowDuringPasswordChange) {
        return NextResponse.json({ error: 'PASSWORD_CHANGE_REQUIRED' }, { status: 403 });
      }

      return handler(req);
    };
  };
}
