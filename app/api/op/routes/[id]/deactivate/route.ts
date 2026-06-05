/**
 * /api/op/routes/[id]/deactivate — soft-delete a route (Issue 012).
 *
 * POST deactivate; cross-op → 404; already deactivated → 422.
 *
 * Status codes (AC verbatim):
 *   200 on success; 404 not_found (cross-op); 422 already_deactivated; 401 unauthorized.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { deactivateRoute } from '@/lib/catalog';
import { RouteServiceError } from '@/lib/catalog';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (_request: NextRequest, authCtx: OperatorAuthContext) => {
      try {
        const route = await deactivateRoute({ operatorId: authCtx.operatorId, routeId: id });
        return NextResponse.json({ route });
      } catch (e) {
        if (e instanceof RouteServiceError) {
          if (e.code === 'not_found') {
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
          }
          if (e.code === 'already_deactivated') {
            return NextResponse.json({ error: 'already_deactivated' }, { status: 422 });
          }
        }
        throw e;
      }
    })
  );

  return wrappedHandler(req);
}
