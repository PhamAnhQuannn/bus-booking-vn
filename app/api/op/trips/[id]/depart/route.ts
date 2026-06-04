/**
 * POST /api/op/trips/:id/depart — mark trip as departed (Issue 014 AC5).
 *
 * No body required. Sets departedAt + salesClosed=true on trip.
 * AC5: depart blocks further bookings on that trip.
 * Idempotent: second call returns HTTP 200 with { alreadyDeparted: true }.
 *
 * 404 on cross-operator or missing trip.
 * 422 if trip is cancelled.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { markDeparted } from '@/lib/trips/markDeparted';
import { TripServiceError } from '@/lib/trips/errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, routeCtx: RouteContext): Promise<Response> {
  const { id } = await routeCtx.params;

  return withErrorHandler(
    requireOperatorAuth({ staffTripScope: () => id })(async (_req: NextRequest, ctx: OperatorAuthContext) => {
      try {
        const result = await markDeparted(ctx.operatorId, id);
        return NextResponse.json({
          ok: result.ok,
          alreadyDeparted: result.alreadyDeparted,
          trip: result.trip,
        });
      } catch (err) {
        if (err instanceof TripServiceError) {
          if (err.code === 'not_found') {
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
          }
          if (err.code === 'trip_cancelled') {
            return NextResponse.json({ error: 'trip_cancelled' }, { status: 422 });
          }
        }
        throw err;
      }
    })
  )(req);
}
