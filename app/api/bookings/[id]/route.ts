/**
 * GET /api/bookings/:id — authenticated customer booking detail (Issue 009,
 * PRD story 16).
 *
 * Auth-only/strict (locked decision Q3): scoped to the JWT sub; a non-owned or
 * missing id is an indistinguishable 404. No confirmationToken access here —
 * guests use /booking/result/[token].
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireCustomerAuth, type CustomerAuthContext } from '@/lib/auth/requireCustomerAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { getCustomerBookingDetail } from '@/lib/booking/getCustomerBookingDetail';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, routeCtx: RouteContext): Promise<Response> {
  const { id } = await routeCtx.params;

  return withErrorHandler(
    requireCustomerAuth()(async (_req: NextRequest, ctx: CustomerAuthContext) => {
      const booking = await getCustomerBookingDetail(ctx.customerId, id);
      if (!booking) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      return NextResponse.json({ booking });
    })
  )(req);
}
