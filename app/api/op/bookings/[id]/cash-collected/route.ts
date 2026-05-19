/**
 * POST /api/op/bookings/:id/cash-collected — mark cash as collected (Issue 014 AC4).
 *
 * I7-compliant: no amount in body — server derives from Booking.totalVnd.
 * Transitions: pending_cash_payment → paid_operator_notified.
 * Emits operator SMS notification (AC1).
 *
 * 404 on cross-operator or missing booking.
 * 422 on invalid_state (booking not in pending_cash_payment).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/db/client';
import { recordCashCollected } from '@/lib/booking/recordCashCollected';
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
        const { booking, totalVnd } = await recordCashCollected(ctx.operatorId, id);
        return NextResponse.json({ booking, collectedVnd: totalVnd });
      } catch (err) {
        if (err instanceof BookingServiceError) {
          if (err.code === 'not_found') {
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
          }
          if (err.code === 'invalid_state') {
            return NextResponse.json({ error: 'invalid_state' }, { status: 422 });
          }
        }
        throw err;
      }
    })
  )(req);
}
