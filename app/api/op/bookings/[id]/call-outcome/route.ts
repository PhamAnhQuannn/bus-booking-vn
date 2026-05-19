/**
 * POST /api/op/bookings/:id/call-outcome — save operator call outcome (Issue 014 AC3).
 *
 * Body: { outcome: 'reached'|'no_answer'|'callback', pickupPointId?, pickupNote? }
 * Pickup dropdown when route has configured pickup points; free-text note when it does not.
 * Returns updated booking DTO.
 *
 * 404 on cross-operator or missing booking.
 * 422 on validation failure.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/db/client';
import { CallOutcomeSchema } from '@/lib/booking/schemas';
import { recordCallOutcome } from '@/lib/booking/recordCallOutcome';
import { BookingServiceError } from '@/lib/booking/recordCallOutcome';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, routeCtx: RouteContext): Promise<Response> {
  const { id } = await routeCtx.params;

  return withErrorHandler(
    requireOperatorAuth({
      // Issue 018: staff are scoped to their assigned trip. Resolve the booking's
      // tripId so the guard can 404 when a staff member targets a booking on
      // another trip (don't leak that the booking exists).
      staffTripScope: async (ctx) => {
        const row = await prisma.booking.findFirst({
          where: { id, trip: { operatorId: ctx.operatorId } },
          select: { tripId: true },
        });
        return row?.tripId ?? null;
      },
    })(async (request: NextRequest, ctx: OperatorAuthContext) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
      }

      const parsed = CallOutcomeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'validation_failed', issues: parsed.error.issues },
          { status: 422 }
        );
      }

      try {
        const booking = await recordCallOutcome(ctx.operatorId, id, parsed.data);
        return NextResponse.json({ booking });
      } catch (err) {
        if (err instanceof BookingServiceError && err.code === 'not_found') {
          return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }
        throw err;
      }
    })
  )(req);
}
