/**
 * POST /api/op/trips/:id/complete — mark trip as completed (Issue 014 AC5).
 *
 * No body required. Sets completedAt and enqueues payout_scheduled NotificationLog rows (S19).
 * Idempotent: second call returns HTTP 200 with { alreadyCompleted: true }.
 *
 * 404 on cross-operator or missing trip.
 * 422 if trip is cancelled.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { markCompleted } from '@/lib/trips/markCompleted';
import { TripServiceError } from '@/lib/trips/errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, routeCtx: RouteContext): Promise<Response> {
  const { id } = await routeCtx.params;

  return withErrorHandler(
    requireOperatorAuth({ staffTripScope: () => id })(async (_req: NextRequest, ctx: OperatorAuthContext) => {
      try {
        const result = await markCompleted(ctx.operatorId, id);
        return NextResponse.json({
          ok: result.ok,
          alreadyCompleted: result.alreadyCompleted,
          trip: result.trip,
          payoutJobsEnqueued: result.payoutJobsEnqueued,
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
