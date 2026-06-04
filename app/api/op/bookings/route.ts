/**
 * GET /api/op/bookings — paginated paid booking queue (Issue 014 AC2).
 *
 * Query params: busId, serviceDate (YYYY-MM-DD), routeId, contactStatus, limit, cursor
 * Returns paid bookings sorted by departure ASC.
 * Tenant-isolated via Trip.operatorId.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { listOperatorBookings, ListOperatorBookingsParamsSchema } from '@/lib/booking';

export const GET = withErrorHandler(
  requireOperatorAuth({})(async (req: NextRequest, ctx: OperatorAuthContext) => {
    const url = new URL(req.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());

    const parsed = ListOperatorBookingsParamsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_failed', issues: parsed.error.issues },
        { status: 422 }
      );
    }

    // Issue 018: staff are auto-scoped to their assigned trip. A no-filter
    // request returns only assigned-trip bookings; an explicit tripId that
    // doesn't match the assignment is a 404 (don't leak other trips). This is
    // inline rather than via the staffTripScope option because the no-filter
    // case must *force* the scope, not reject the request.
    if (ctx.role === 'staff') {
      if (ctx.assignedTripId === null) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (parsed.data.tripId && parsed.data.tripId !== ctx.assignedTripId) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      parsed.data.tripId = ctx.assignedTripId;
    }

    const result = await listOperatorBookings(ctx.operatorId, parsed.data);
    return NextResponse.json(result);
  })
);
