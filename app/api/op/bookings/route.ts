/**
 * GET /api/op/bookings — paginated paid booking queue (Issue 014 AC2).
 *
 * Query params: busId, serviceDate (YYYY-MM-DD), routeId, contactStatus, limit, cursor
 * Returns paid bookings sorted by departure ASC.
 * Tenant-isolated via Trip.operatorId.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { listOperatorBookings, ListOperatorBookingsParamsSchema } from '@/lib/booking/listOperatorBookings';

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

    const result = await listOperatorBookings(ctx.operatorId, parsed.data);
    return NextResponse.json(result);
  })
);
