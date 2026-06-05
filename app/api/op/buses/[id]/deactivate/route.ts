/**
 * POST /api/op/buses/[id]/deactivate  — soft-delete a bus (Issue 011).
 *
 * AC10: rejects if any future trip (departureAt > now, status scheduled/departed)
 *       is still assigned to this bus → 422 future_trips_assigned with tripIds[].
 * AC11: re-activation NOT supported. If the bus is already deactivated, returns
 *       422 reactivation_not_supported.
 * AC6:  cross-op → 404 not_found.
 *
 * Gated by requireOperatorAuth; operatorId from JWT.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { deactivateBus } from '@/lib/catalog';
import { prisma } from '@/lib/core/db/client';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (_request: NextRequest, authCtx: OperatorAuthContext) => {
      // Ownership check via list-with-scope. We let deactivateBus handle the
      // not_found / already_deactivated branches once we've cleared the future-trip gate.
      const owned = await prisma.bus.findFirst({
        where: { id, operatorId: authCtx.operatorId },
        select: { id: true, deactivatedAt: true },
      });
      if (!owned) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (owned.deactivatedAt !== null) {
        return NextResponse.json(
          { error: 'reactivation_not_supported' },
          { status: 422 }
        );
      }

      // AC10 — block when future trips remain assigned.
      const now = new Date();
      const futureTrips = await prisma.trip.findMany({
        where: {
          busId: id,
          departureAt: { gt: now },
          status: { in: ['scheduled', 'departed'] },
        },
        select: { id: true },
        orderBy: { departureAt: 'asc' },
      });
      if (futureTrips.length > 0) {
        return NextResponse.json(
          {
            error: 'future_trips_assigned',
            tripIds: futureTrips.map((t) => t.id),
          },
          { status: 422 }
        );
      }

      const result = await deactivateBus(authCtx.operatorId, id);
      if (!result.ok) {
        if (result.reason === 'not_found') {
          return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }
        return NextResponse.json(
          { error: 'reactivation_not_supported' },
          { status: 422 }
        );
      }
      return NextResponse.json({ ok: true, deactivatedAt: result.deactivatedAt });
    })
  );

  return wrappedHandler(req);
}
