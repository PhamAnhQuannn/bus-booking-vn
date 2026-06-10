/**
 * /api/op/trips/[id]/pickup-areas — edit a trip's enabled pickup-area subset (operator).
 *
 * PATCH { pickupAreaIds: string[] } → replaces the set. Cross-op / missing → 404;
 * an id that isn't one of the operator's active areas → 422 invalid_pickup_area.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { setTripPickupAreas, TripServiceError } from '@/lib/trips';

const schema = z.object({ pickupAreaIds: z.array(z.string()).max(50) });

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
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
        return NextResponse.json({ error: 'validation_failed', issues: parsed.error.issues }, { status: 422 });
      }

      try {
        const areas = await setTripPickupAreas({
          operatorId: authCtx.operatorId,
          tripId: id,
          pickupAreaIds: parsed.data.pickupAreaIds,
        });
        return NextResponse.json({ areas });
      } catch (e) {
        if (e instanceof TripServiceError) {
          const status = e.code === 'not_found' ? 404 : 422;
          return NextResponse.json({ error: e.code }, { status });
        }
        throw e;
      }
    })
  );

  return wrapped(req);
}
