/**
 * GET /api/op/bookings/:id — full booking detail (Issue 014).
 *
 * Tenant-isolated: 404 on cross-operator or missing booking.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { getOperatorBooking } from '@/lib/booking';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, routeCtx: RouteContext): Promise<Response> {
  const { id } = await routeCtx.params;

  return withErrorHandler(
    requireOperatorAuth({})(async (_req: NextRequest, ctx: OperatorAuthContext) => {
      const booking = await getOperatorBooking(ctx.operatorId, id);
      if (!booking) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      return NextResponse.json({ booking });
    })
  )(req);
}
