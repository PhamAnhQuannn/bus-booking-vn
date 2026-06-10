/**
 * /api/op/pickup-areas/[id] — edit a named pickup point (name + addressLine).
 *
 * PATCH update; cross-op / missing → 404; duplicate name in ward → 422.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { updateOperatorPickupArea, PickupAreaServiceError } from '@/lib/catalog';
import { operatorPickupAreaUpdateSchema } from '@/lib/core/validation/pickupArea';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrapped = withErrorHandler(
    requireOperatorAuth({})(async (request: NextRequest, authCtx: OperatorAuthContext) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 });
      }

      const parsed = operatorPickupAreaUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 422 });
      }

      try {
        const area = await updateOperatorPickupArea({
          operatorId: authCtx.operatorId,
          areaId: id,
          data: parsed.data,
        });
        return NextResponse.json({ area });
      } catch (e) {
        if (e instanceof PickupAreaServiceError) {
          const status = e.code === 'not_found' ? 404 : 422;
          return NextResponse.json({ error: e.code }, { status });
        }
        throw e;
      }
    })
  );

  return wrapped(req);
}
