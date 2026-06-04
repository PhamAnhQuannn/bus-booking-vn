/**
 * POST /api/op/bookings/:id/check-in — single-use boarding check-in (Issue 073).
 *
 * No body. Atomic, idempotent: a second scan returns 200 { alreadyCheckedIn:true }.
 *
 * Tenant + staff scoped: requireOperatorAuth with a staffTripScope resolver that
 * maps the booking → its tripId, so a staff member can only check in passengers
 * on their assigned trip (mismatch → 404, no cross-trip leak). The service ALSO
 * scopes the UPDATE on Trip.operatorId — defense in depth.
 *
 *   ok        → 200 { ok:true, alreadyCheckedIn }
 *   not_found → 404 (missing / cross-operator)
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/core/db/client';
import { checkInBooking } from '@/lib/booking';
import { resolveBookingTripId } from '@/lib/booking';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, routeCtx: RouteContext): Promise<Response> {
  const { id } = await routeCtx.params;

  return withErrorHandler(
    requireOperatorAuth({
      staffTripScope: (ctx) => resolveBookingTripId(ctx.operatorId, id),
    })(async (_req: NextRequest, ctx: OperatorAuthContext) => {
      const result = await checkInBooking(prisma, { bookingId: id, operatorId: ctx.operatorId });
      if (!result.ok) {
        return NextResponse.json({ error: result.reason }, { status: 404 });
      }
      return NextResponse.json({ ok: true, alreadyCheckedIn: result.alreadyCheckedIn });
    })
  )(req);
}
