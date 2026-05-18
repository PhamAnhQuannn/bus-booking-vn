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
import { prisma } from '@/lib/db/client';
import { extractHoldCookie } from '@/lib/security/holdCookie';
import { withErrorHandler } from '@/lib/withErrorHandler';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const wrappedHandler = withErrorHandler(async (request: NextRequest) => {
    const { id } = await ctx.params;

    // ---- 1. Verify bb_hold cookie ----
    const cookieHeader = request.headers.get('cookie');
    const verified = extractHoldCookie(cookieHeader);

    if (!verified || verified.holdId !== id) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // ---- 2. Load hold from DB ----
    const hold = await prisma.hold.findUnique({
      where: { id },
      select: {
        id: true,
        tripId: true,
        ticketCount: true,
        expiresAt: true,
        status: true,
        trip: {
          select: {
            price: true,
          },
        },
      },
    });

    if (!hold) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    // ---- 3. Return hold details ----
    const totalVND = hold.trip.price * hold.ticketCount;

    return NextResponse.json(
      {
        tripId: hold.tripId,
        ticketCount: hold.ticketCount,
        expiresAt: hold.expiresAt.toISOString(),
        totalVND,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  });

  return wrappedHandler(req);
}
