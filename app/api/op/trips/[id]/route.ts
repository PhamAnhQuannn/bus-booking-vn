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
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { getTrip } from '@/lib/trips/getTrip';
import { PatchTripSchema } from '@/lib/core/validation/trip';
import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
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

      // Cross-op guard + price-lock-after-sale (S15#6), serialised against concurrent
      // sells via SELECT ... FOR UPDATE on the Trip row (TOCTOU guard per I11 pattern).
      const result = await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ id: string; status: string }[]>(Prisma.sql`
          SELECT id, status FROM "Trip"
          WHERE id = ${id} AND "operatorId" = ${authCtx.operatorId}
          FOR UPDATE
        `);
        if (locked.length === 0) return { kind: 'not_found' as const };
        if (locked[0].status === 'cancelled') return { kind: 'already_cancelled' as const };

        // Once ANY seat is paid, price + departureAt are LOCKED (S15#6). departureAt is not
        // in the PATCH schema, so only price needs the guard. Non-material edits (salesClosed,
        // blockedSeats) stay allowed regardless.
        if (parsed.data.price !== undefined) {
          const paidCount = await tx.booking.count({
            where: { tripId: id, status: { in: ['paid', 'completed'] } },
          });
          if (paidCount > 0) return { kind: 'price_locked' as const };
        }

        const updated = await tx.trip.update({
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
                    status: { in: ['paid', 'completed'] },
                  },
                },
              },
            },
          },
        });
        return { kind: 'ok' as const, trip: updated };
      });

      if (result.kind === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
      if (result.kind === 'already_cancelled') return NextResponse.json({ error: 'already_cancelled' }, { status: 422 });
      if (result.kind === 'price_locked') return NextResponse.json({ error: 'price_locked_after_sale' }, { status: 422 });
      return NextResponse.json({ trip: toTripDto(result.trip) });
    })
  );
  return wrappedHandler(req);
}
