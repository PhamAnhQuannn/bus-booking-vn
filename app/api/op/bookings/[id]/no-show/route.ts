/**
 * POST /api/op/bookings/:id/no-show — mark a booking as no-show (Issue 073).
 *
 * No body. Sets status='no_show' AND noShowAt together (Issue 014 verb-At+status
 * pairing). Guarded: a passenger who already boarded (checkedInAt set) can't be
 * no-showed.
 *
 * Tenant + staff scoped via the same staffTripScope resolver as check-in.
 *
 *   ok                → 200 { ok:true }
 *   already_checked_in → 422 (already boarded — can't no-show)
 *   not_found         → 404 (missing / cross-operator / wrong state)
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/core/db/client';
import { markNoShow } from '@/lib/booking/checkIn';
import { resolveBookingTripId } from '@/lib/booking/resolveBookingTripId';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, routeCtx: RouteContext): Promise<Response> {
  const { id } = await routeCtx.params;

  return withErrorHandler(
    requireOperatorAuth({
      staffTripScope: (ctx) => resolveBookingTripId(ctx.operatorId, id),
    })(async (_req: NextRequest, ctx: OperatorAuthContext) => {
      const result = await markNoShow(prisma, { bookingId: id, operatorId: ctx.operatorId });
      if (!result.ok) {
        if (result.reason === 'already_checked_in') {
          return NextResponse.json({ error: 'already_checked_in' }, { status: 422 });
        }
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    })
  )(req);
}
