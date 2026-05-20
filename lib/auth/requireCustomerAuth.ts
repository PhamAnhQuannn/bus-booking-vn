/**
 * requireCustomerAuth — HOF that guards customer-facing API routes (Issue 009).
 *
 * Customer access tokens are Bearer tokens held in client memory (returned in
 * the login/register response body, NOT a cookie — contrast operator auth which
 * uses the bb_op_access HttpOnly cookie). Routes therefore read the token from
 * the `Authorization: Bearer <token>` header.
 *
 * Usage (mirrors requireOperatorAuth — params captured via closure):
 *   export async function GET(req: NextRequest, ctx: RouteContext) {
 *     const { id } = await ctx.params;
 *     return withErrorHandler(
 *       requireCustomerAuth()(async (_req, authCtx) => {
 *         // authCtx.customerId is the verified Customer.id
 *       })
 *     )(req);
 *   }
 *
 * 401 UNAUTHORIZED when the header is missing/malformed or the token fails
 * verification (expired, tampered, or operator-scoped — verifyAccess rejects
 * scope='operator'). No DB lookup: the JWT sub IS the Customer.id, and every
 * guarded route scopes its own query by customerId, so a deleted/forged id
 * simply matches zero rows.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifyAccess } from './jwt';

/** Context the HOF threads to the wrapped handler. */
export interface CustomerAuthContext {
  customerId: string;
}

type Handler = (req: NextRequest, ctx: CustomerAuthContext) => Promise<Response>;
type LegacyHandler = (req: NextRequest) => Promise<Response>;
type HOF = (handler: Handler) => LegacyHandler;

function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header);
  return match ? match[1] : null;
}

export function requireCustomerAuth(): HOF {
  return (handler: Handler): LegacyHandler => {
    return async (req: NextRequest): Promise<Response> => {
      const token = extractBearer(req.headers.get('authorization'));
      if (!token) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }

      const payload = await verifyAccess(token);
      if (!payload) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }

      return handler(req, { customerId: payload.sub });
    };
  };
}
