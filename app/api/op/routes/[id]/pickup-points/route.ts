/**
 * /api/op/routes/[id]/pickup-points — pickup point collection (Issue 012).
 *
 * GET   list all pickup points for the route (cross-op → 404).
 * POST  create a new pickup point.
 * PATCH bulk reorder (body: { orderedIds: string[] }).
 *
 * Status codes (AC verbatim):
 *   200 on list/reorder; 201 on create.
 *   400 bad_request; 401 unauthorized; 404 not_found (cross-op route).
 *   422 too_many_pickup_points | unknown_pickup_points | incomplete_reorder | invalid_input.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { listPickupPoints } from '@/lib/catalog/listPickupPoints';
import { createPickupPoint, PickupPointServiceError } from '@/lib/catalog/createPickupPoint';
import { bulkReorder } from '@/lib/catalog/bulkReorder';
import { pickupPointCreateSchema, bulkReorderSchema } from '@/lib/core/validation/route';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (_request: NextRequest, authCtx: OperatorAuthContext) => {
      const pickupPoints = await listPickupPoints({ operatorId: authCtx.operatorId, routeId: id });
      if (pickupPoints === null) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      return NextResponse.json({ pickupPoints });
    })
  );

  return wrappedHandler(req);
}

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (request: NextRequest, authCtx: OperatorAuthContext) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 });
      }

      const parsed = pickupPointCreateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'invalid_input', issues: parsed.error.issues },
          { status: 422 }
        );
      }

      try {
        const pickupPoint = await createPickupPoint({
          operatorId: authCtx.operatorId,
          routeId: id,
          data: parsed.data,
        });
        return NextResponse.json({ pickupPoint }, { status: 201 });
      } catch (e) {
        if (e instanceof PickupPointServiceError) {
          if (e.code === 'not_found') {
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
          }
          if (e.code === 'too_many_pickup_points') {
            return NextResponse.json({ error: 'too_many_pickup_points' }, { status: 422 });
          }
        }
        throw e;
      }
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

      const parsed = bulkReorderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'invalid_input', issues: parsed.error.issues },
          { status: 422 }
        );
      }

      try {
        const pickupPoints = await bulkReorder({
          operatorId: authCtx.operatorId,
          routeId: id,
          orderedIds: parsed.data.orderedIds,
        });
        return NextResponse.json({ pickupPoints });
      } catch (e) {
        if (e instanceof PickupPointServiceError) {
          if (e.code === 'not_found') {
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
          }
          if (e.code === 'unknown_pickup_points') {
            return NextResponse.json({ error: 'unknown_pickup_points' }, { status: 422 });
          }
          if (e.code === 'incomplete_reorder') {
            return NextResponse.json({ error: 'incomplete_reorder' }, { status: 422 });
          }
        }
        throw e;
      }
    })
  );

  return wrappedHandler(req);
}
