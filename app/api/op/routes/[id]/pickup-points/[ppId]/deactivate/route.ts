/**
 * /api/op/routes/[id]/pickup-points/[ppId]/deactivate — soft-delete a pickup point (Issue 012).
 *
 * POST deactivate; cross-op route → 404; already deactivated → 422.
 *
 * Status codes (AC verbatim):
 *   200 on success; 404 not_found; 422 already_deactivated; 401 unauthorized.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { deactivatePickupPoint } from '@/lib/catalog/deactivatePickupPoint';
import { PickupPointServiceError } from '@/lib/catalog/createPickupPoint';

type RouteContext = { params: Promise<{ id: string; ppId: string }> };

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id, ppId } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (_request: NextRequest, authCtx: OperatorAuthContext) => {
      try {
        const pickupPoint = await deactivatePickupPoint({
          operatorId: authCtx.operatorId,
          routeId: id,
          ppId,
        });
        return NextResponse.json({ pickupPoint });
      } catch (e) {
        if (e instanceof PickupPointServiceError) {
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
