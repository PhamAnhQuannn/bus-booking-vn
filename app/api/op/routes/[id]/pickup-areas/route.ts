/**
 * /api/op/routes/[id]/pickup-areas — manage a route's assigned pickup-area subset
 * (Issue 113). Pickup areas are route-scoped; this is the operator surface that picks
 * which of the operator's menu areas apply to a route.
 *
 * GET → { areas } current assignments (active areas, ordered).
 * PUT { areaIds: string[] } → full-replace the set. Cross-op / missing route → 404;
 * an id that isn't one of the operator's active areas → 422 invalid_pickup_area.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { listRoutePickupAreas, setRoutePickupAreas, RoutePickupAreaServiceError } from '@/lib/catalog';

const schema = z.object({ areaIds: z.array(z.string()).max(100) });

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrapped = withErrorHandler(
    requireOperatorAuth({})(async (_request: NextRequest, authCtx: OperatorAuthContext) => {
      const areas = await listRoutePickupAreas({ operatorId: authCtx.operatorId, routeId: id });
      return NextResponse.json({ areas });
    })
  );

  return wrapped(req);
}

export async function PUT(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrapped = withErrorHandler(
    requireOperatorAuth({})(async (request: NextRequest, authCtx: OperatorAuthContext) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
      }

      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'validation_failed', issues: parsed.error.issues },
          { status: 422 }
        );
      }

      try {
        await setRoutePickupAreas({
          operatorId: authCtx.operatorId,
          routeId: id,
          areaIds: parsed.data.areaIds,
        });
        const areas = await listRoutePickupAreas({ operatorId: authCtx.operatorId, routeId: id });
        return NextResponse.json({ areas });
      } catch (e) {
        if (e instanceof RoutePickupAreaServiceError) {
          const status = e.code === 'not_found' ? 404 : 422;
          return NextResponse.json({ error: e.code }, { status });
        }
        throw e;
      }
    })
  );

  return wrapped(req);
}
