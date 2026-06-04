/**
 * POST /api/op/scan — resolve a scanned ticket token to a boarding view (Issue 073).
 *
 * Body: { token: string } — the signed ticket JWT scanned from the passenger QR.
 *
 * Operator-scoped via requireOperatorAuth. Staff scoping can't use the
 * staffTripScope option here because the target trip is only known AFTER the
 * token resolves to a booking — so we resolve the booking first, then enforce
 * `tripId === ctx.assignedTripId` inline for staff (mismatch → 404, mirroring
 * requireOperatorAuth's staffTripScope intent: never leak other trips' existence).
 *
 * Reason → status mapping:
 *   invalid_token  → 404 (generic not-found, no existence leak)
 *   wrong_operator → 404 (cross-tenant token treated as not-found, AC4)
 *   not_paid       → 422
 *   ok             → 200 { booking }
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/core/db/client';
import { scanTicket } from '@/lib/booking';

export const POST = withErrorHandler(
  requireOperatorAuth({})(async (req: NextRequest, ctx: OperatorAuthContext) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'validation_failed' }, { status: 422 });
    }

    const token = (body as { token?: unknown })?.token;
    if (typeof token !== 'string' || token.length === 0) {
      return NextResponse.json({ error: 'validation_failed' }, { status: 422 });
    }

    const result = await scanTicket(prisma, { token, operatorId: ctx.operatorId });

    if (!result.ok) {
      if (result.reason === 'not_paid') {
        return NextResponse.json({ error: 'not_paid' }, { status: 422 });
      }
      // invalid_token | wrong_operator → generic 404 (no existence leak).
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // Staff are constrained to their assigned trip — a scan for any other trip is
    // a 404 (do not reveal that the booking / trip exists).
    if (ctx.role === 'staff' && result.booking.tripId !== ctx.assignedTripId) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({ booking: result.booking });
  })
);
