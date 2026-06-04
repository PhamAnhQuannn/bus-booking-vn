/**
 * /api/op/routes/[id] — single route (Issue 012).
 *
 * GET   return route + pickup points (cross-op → 404).
 * PATCH partial update; deactivated route → 422 reactivation_not_supported.
 *
 * Status codes (AC verbatim):
 *   200 on get/update; 404 not_found (cross-op); 422 reactivation_not_supported | invalid_input.
 *   400 bad_request (malformed JSON); 401 unauthorized.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { getRouteById } from '@/lib/catalog/getRouteById';
import { updateRoute, RouteServiceError } from '@/lib/catalog/updateRoute';
import { routePatchSchema } from '@/lib/core/validation/route';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (_request: NextRequest, authCtx: OperatorAuthContext) => {
      const route = await getRouteById({ operatorId: authCtx.operatorId, routeId: id });
      if (!route) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      return NextResponse.json({ route });
    })
  );

  return wrappedHandler(req);
}

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (request: NextRequest, authCtx: OperatorAuthContext) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 });
      }

      const parsed = routePatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'invalid_input', issues: parsed.error.issues },
          { status: 422 }
        );
      }

      try {
        const route = await updateRoute({
          operatorId: authCtx.operatorId,
          routeId: id,
          data: parsed.data,
        });
        return NextResponse.json({ route });
      } catch (e) {
        if (e instanceof RouteServiceError) {
          if (e.code === 'not_found') {
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
          }
          if (e.code === 'reactivation_not_supported') {
            return NextResponse.json({ error: 'reactivation_not_supported' }, { status: 422 });
          }
        }
        throw e;
      }
    })
  );

  return wrappedHandler(req);
}
