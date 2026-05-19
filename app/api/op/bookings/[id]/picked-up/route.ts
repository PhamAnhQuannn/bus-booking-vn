/**
 * POST /api/op/bookings/:id/picked-up — SET-TRUE-ONLY boarding marker (Issue 014 SPEC NOTE).
 *
 * SPEC NOTE: Implementation is SET-TRUE-ONLY (not a toggle). See lib/booking/markPickedUp.ts.
 * Idempotent: second call returns HTTP 200 with { alreadyPickedUp: true }.
 *
 * 404 on cross-operator or missing booking.
 * 422 if paymentStatus does not meet payment_required guard.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/db/client';
import { markPickedUp } from '@/lib/booking/markPickedUp';
import { BookingServiceError } from '@/lib/booking/recordCallOutcome';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, routeCtx: RouteContext): Promise<Response> {
  const { id } = await routeCtx.params;

  return withErrorHandler(
    requireOperatorAuth({
      // Issue 018: staff scoped to assigned trip — resolve booking's tripId so the
      // guard 404s when a staff member targets a booking on another trip.
      staffTripScope: async (ctx) => {
        const row = await prisma.booking.findFirst({
          where: { id, trip: { operatorId: ctx.operatorId } },
          select: { tripId: true },
        });
        return row?.tripId ?? null;
      },
    })(async (_req: NextRequest, ctx: OperatorAuthContext) => {
      try {
        const result = await markPickedUp(ctx.operatorId, id);
        // HTTP 200 unconditionally — idempotent path uses discriminator field (Issue 013 rule)
        return NextResponse.json({
          ok: result.ok,
          alreadyPickedUp: result.alreadyPickedUp,
          booking: result.booking,
        });
      } catch (err) {
        if (err instanceof BookingServiceError) {
          if (err.code === 'not_found') {
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
          }
          if (err.code === 'payment_required') {
            return NextResponse.json({ error: 'payment_required' }, { status: 422 });
          }
        }
        throw err;
      }
    })
  )(req);
}
