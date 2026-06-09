/**
 * /api/op/pickup-areas/[id]/deactivate — soft-delete a pickup-area (Issue 105).
 *
 * POST deactivate; cross-op / missing → 404; already inactive → 422.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { deactivateOperatorPickupArea, PickupAreaServiceError } from '@/lib/catalog';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrapped = withErrorHandler(
    requireOperatorAuth({})(async (_request: NextRequest, authCtx: OperatorAuthContext) => {
      try {
        const area = await deactivateOperatorPickupArea({ operatorId: authCtx.operatorId, areaId: id });
        return NextResponse.json({ area });
      } catch (e) {
        if (e instanceof PickupAreaServiceError) {
          if (e.code === 'not_found') {
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
          }
          if (e.code === 'already_inactive') {
            return NextResponse.json({ error: 'already_inactive' }, { status: 422 });
          }
        }
        throw e;
      }
    })
  );

  return wrapped(req);
}
