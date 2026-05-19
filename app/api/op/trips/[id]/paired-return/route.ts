/**
 * POST /api/op/trips/[id]/paired-return — create paired return trip (Issue 013 AC6).
 *
 * 422 no_reverse_route — no reverse route found (NO auto-creation)
 * 422 bus_in_maintenance
 * 422 bus_deactivated
 * 422 bus_overlap_with_outbound — bus already assigned to overlapping trip (AC6)
 *     NOTE: reassign-bus returns 409 for the same error code; AC6 spec says 422 here.
 *     Spec conflict flagged — this file follows AC6 verbatim.
 * 404 not_found (cross-op)
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { pairedReturn } from '@/lib/trips/pairedReturn';
import { TripServiceError } from '@/lib/trips/errors';
import { PairedReturnSchema } from '@/lib/validation/trip';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (request: NextRequest, authCtx: OperatorAuthContext) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
      }

      const parsed = PairedReturnSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'validation_failed', issues: parsed.error.issues }, { status: 422 });
      }

      try {
        const result = await pairedReturn(
          authCtx.operatorId,
          id,
          parsed.data.returnDepartureAt,
          parsed.data.price
        );
        return NextResponse.json({ outboundTrip: result.outboundTrip, returnTrip: result.returnTrip }, { status: 201 });
      } catch (e) {
        if (e instanceof TripServiceError) {
          if (e.code === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
          if (e.code === 'no_reverse_route') return NextResponse.json({ error: 'no_reverse_route' }, { status: 422 });
          if (e.code === 'bus_in_maintenance') return NextResponse.json({ error: 'bus_in_maintenance' }, { status: 422 });
          if (e.code === 'bus_deactivated') return NextResponse.json({ error: 'bus_deactivated' }, { status: 422 });
          if (e.code === 'trip_cancelled') return NextResponse.json({ error: 'trip_cancelled' }, { status: 422 });
          // AC6: 422 for bus overlap on paired-return path (spec conflict: reassign-bus uses 409 for same code)
          if (e.code === 'bus_overlap_with_outbound') return NextResponse.json({ error: 'bus_overlap_with_outbound' }, { status: 422 });
        }
        // Invalid return time
        if (e instanceof Error && e.message.includes('returnDepartureAt must be')) {
          return NextResponse.json({ error: 'invalid_return_time', message: e.message }, { status: 422 });
        }
        throw e;
      }
    })
  );
  return wrappedHandler(req);
}
