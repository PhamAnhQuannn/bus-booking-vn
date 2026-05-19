/**
 * /api/op/trips/[id] — single trip routes (Issue 013).
 *
 * GET   — fetch trip detail
 * PATCH — partial update (price, salesClosed, blockedSeats)
 *
 * Cross-op → 404 not_found (I2).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { getTrip } from '@/lib/trips/getTrip';
import { PatchTripSchema } from '@/lib/validation/trip';
import { prisma } from '@/lib/db/client';
import { toTripDto } from '@/lib/trips/toTripDto';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (_req: NextRequest, authCtx: OperatorAuthContext) => {
      const trip = await getTrip(authCtx.operatorId, id);
      if (!trip) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json({ trip });
    })
  );
  return wrappedHandler(req);
}

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (request: NextRequest, authCtx: OperatorAuthContext) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
      }

      const parsed = PatchTripSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'validation_failed', issues: parsed.error.issues }, { status: 422 });
      }

      // Cross-op guard
      const existing = await prisma.trip.findFirst({
        where: { id, operatorId: authCtx.operatorId },
        select: { id: true, status: true },
      });
      if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      if (existing.status === 'cancelled') return NextResponse.json({ error: 'already_cancelled' }, { status: 422 });

      const updated = await prisma.trip.update({
        where: { id },
        data: {
          ...(parsed.data.price !== undefined ? { price: parsed.data.price } : {}),
          ...(parsed.data.salesClosed !== undefined ? { salesClosed: parsed.data.salesClosed } : {}),
          ...(parsed.data.blockedSeats !== undefined ? { blockedSeats: parsed.data.blockedSeats } : {}),
        },
        include: {
          bus: { select: { capacity: true } },
          _count: {
            select: {
              holds: { where: { status: 'active' } },
              bookings: {
                where: {
                  status: { in: ['pending_cash_payment', 'paid_operator_notified', 'completed'] },
                },
              },
            },
          },
        },
      });

      return NextResponse.json({ trip: toTripDto(updated) });
    })
  );
  return wrappedHandler(req);
}
