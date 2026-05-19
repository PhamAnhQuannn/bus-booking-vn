/**
 * POST /api/op/trips/[id]/manual-booking — operator walk-in / phone-in booking (Issue 015).
 *
 * // I7-exempt: operator is price authority for their own trips — totalVnd is
 * // derived server-side from trip.price * ticketCount, not from the request body.
 *
 * Kill-switch: MANUAL_BOOKING_ENABLED env var (default-on).
 *   Set MANUAL_BOOKING_ENABLED=false to disable and return 503 { reason: 'feature_disabled' }.
 *
 * Status codes:
 *   200  — booking created
 *   400  — invalid request body (JSON parse failure)
 *   401  — not authenticated
 *   403  — password change required
 *   404  — trip not found / cross-operator access
 *   422  — validation failure | trip_not_bookable | sold_out
 *   503  — kill-switch off | unexpected service error
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { ManualBookingSchema } from '@/lib/validation/trip';
import { createManualBooking } from '@/lib/booking/createManualBooking';
import { after } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id: tripId } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (request: NextRequest, authCtx: OperatorAuthContext) => {
      // Kill-switch (default-on: missing or any value other than 'false' means enabled)
      if (process.env.MANUAL_BOOKING_ENABLED === 'false') {
        return NextResponse.json({ reason: 'feature_disabled' }, { status: 503 });
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
      }

      const parsed = ManualBookingSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'validation_failed', issues: parsed.error.issues },
          { status: 422 }
        );
      }

      const { buyerName, buyerPhone, ticketCount, paymentMethod } = parsed.data;

      const result = await createManualBooking({
        tripId,
        operatorId: authCtx.operatorId,
        buyerName,
        buyerPhone,
        ticketCount,
        paymentMethod,
      });

      if (!result.ok) {
        switch (result.reason) {
          case 'not_found':
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
          case 'trip_not_bookable':
            return NextResponse.json({ error: 'trip_not_bookable' }, { status: 422 });
          case 'sold_out':
            return NextResponse.json({ error: 'sold_out' }, { status: 422 });
          case 'ref_collision':
            return NextResponse.json({ error: 'ref_collision' }, { status: 503 });
        }
      }

      // Dispatch notifications post-response via next/server after()
      after(result.afterFn);

      return NextResponse.json({ booking: result.booking }, { status: 200 });
    })
  );

  return wrappedHandler(req);
}
