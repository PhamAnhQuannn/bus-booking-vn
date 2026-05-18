/**
 * GET /api/holds/[id]
 *
 * Returns hold details for the authenticated buyer.
 *
 * Auth: verifies bb_hold cookie value matches the requested holdId.
 *       Returns 401 on any mismatch or missing cookie.
 *
 * Response: { tripId, ticketCount, expiresAt, totalVND }
 *   - totalVND = trip.price * ticketCount (server-computed, never client-trusted)
 *
 * Wrapped in withErrorHandler — 500 scrubbed.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { extractHoldCookie } from '@/lib/security/holdCookie';
import { getHoldDetails } from '@/lib/booking/getHoldDetails';
import { withErrorHandler } from '@/lib/withErrorHandler';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const wrappedHandler = withErrorHandler(async (request: NextRequest) => {
    const { id } = await ctx.params;

    const cookieHeader = request.headers.get('cookie');
    const verified = extractHoldCookie(cookieHeader);

    if (!verified || verified.holdId !== id) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const details = await getHoldDetails(id);

    if (!details) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json(details, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  });

  return wrappedHandler(req);
}
