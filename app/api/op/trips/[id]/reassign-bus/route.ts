/**
 * POST /api/op/trips/[id]/reassign-bus — reassign bus to a trip (Issue 013 AC3).
 *
 * Status codes (verbatim from AC, I3):
 *   422 capacity_too_small  { required, provided }
 *   422 bus_deactivated
 *   422 bus_in_maintenance
 *   409 bus_overlap_with_outbound
 *   404 not_found
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { reassignBus } from '@/lib/trips/reassignBus';
import { TripServiceError } from '@/lib/trips/errors';
import { ReassignBusSchema } from '@/lib/core/validation/trip';

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

      const parsed = ReassignBusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'validation_failed', issues: parsed.error.issues }, { status: 422 });
      }

      try {
        const trip = await reassignBus(authCtx.operatorId, id, parsed.data.busId);
        return NextResponse.json({ trip });
      } catch (e) {
        if (e instanceof TripServiceError) {
          if (e.code === 'not_found') {
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
          }
          if (e.code === 'bus_deactivated') {
            return NextResponse.json({ error: 'bus_deactivated' }, { status: 422 });
          }
          if (e.code === 'bus_in_maintenance') {
            return NextResponse.json({ error: 'bus_in_maintenance' }, { status: 422 });
          }
          if (e.code === 'capacity_too_small') {
            return NextResponse.json(
              {
                error: 'capacity_too_small',
                required: e.meta?.required,
                provided: e.meta?.provided,
              },
              { status: 422 }
            );
          }
          if (e.code === 'bus_overlap_with_outbound') {
            return NextResponse.json({ error: 'bus_overlap_with_outbound' }, { status: 409 });
          }
        }
        throw e;
      }
    })
  );
  return wrappedHandler(req);
}
