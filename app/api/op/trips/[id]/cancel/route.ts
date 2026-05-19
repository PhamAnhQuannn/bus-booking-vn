/**
 * POST /api/op/trips/[id]/cancel — atomically cancel a trip (Issue 013 AC4).
 *
 * 200 { trip, ok: true } on success (first cancel)
 * 200 { trip, already_cancelled: true } on idempotent re-cancel (AC3)
 * 404 not_found (cross-op)
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { cancelTrip } from '@/lib/trips/cancelTrip';
import { TripServiceError } from '@/lib/trips/errors';
import { CancelTripSchema } from '@/lib/validation/trip';

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

      const parsed = CancelTripSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'validation_failed', issues: parsed.error.issues }, { status: 422 });
      }

      try {
        const result = await cancelTrip(authCtx.operatorId, id, parsed.data.reason);
        // AC3: idempotent re-cancel returns 200 with already_cancelled:true (not 422)
        return NextResponse.json({
          trip: result.trip,
          ok: !result.alreadyCancelled,
          already_cancelled: result.alreadyCancelled,
          ...(result.alreadyCancelled ? {} : {
            cancelledBookings: result.cancelledBookings,
            cancelledHolds: result.cancelledHolds,
            notificationsEnqueued: result.notificationsEnqueued,
          }),
        });
      } catch (e) {
        if (e instanceof TripServiceError) {
          if (e.code === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }
        throw e;
      }
    })
  );
  return wrappedHandler(req);
}
