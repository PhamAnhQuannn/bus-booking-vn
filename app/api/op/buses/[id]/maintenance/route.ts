/**
 * POST /api/op/buses/[id]/maintenance — create a maintenance window (Issue 011).
 *
 * AC4 conflict semantics:
 *   - maintenance-vs-maintenance overlap on the SAME bus → HARD block 409
 *     maintenance_overlap with overlapping[].
 *   - maintenance-vs-trip overlap on the SAME bus → SOFT warning; insert still
 *     happens, response body includes conflictingTrips[] (status 201).
 *
 * Overlap predicate (per Issue 001 Mistake Log): window-vs-window
 *   intervals [aStart, aEnd] and [bStart, bEnd] overlap iff
 *     aStart <= bEnd AND aEnd >= bStart
 *
 * AC6: cross-op bus → 404 not_found.
 * AC11: editing deactivated buses unsupported → 422 reactivation_not_supported
 *       (maintenance is an edit; we reject adding windows to a soft-deleted bus).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/db/client';
import { CreateMaintenanceSchema } from '@/lib/core/validation/bus';
import {
  findMaintenanceOverlaps,
  findTripOverlaps,
} from '@/lib/catalog/getMaintenanceConflicts';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (request: NextRequest, authCtx: OperatorAuthContext) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
      }

      const parsed = CreateMaintenanceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'invalid_input', issues: parsed.error.issues },
          { status: 422 }
        );
      }

      // Ownership / soft-delete gate.
      const bus = await prisma.bus.findFirst({
        where: { id, operatorId: authCtx.operatorId },
        select: { id: true, deactivatedAt: true },
      });
      if (!bus) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (bus.deactivatedAt !== null) {
        return NextResponse.json(
          { error: 'reactivation_not_supported' },
          { status: 422 }
        );
      }

      const { startAt, endAt, reason } = parsed.data;

      // AC4 — hard block on maintenance-vs-maintenance overlap.
      const overlapping = await findMaintenanceOverlaps({
        busId: id,
        startAt,
        endAt,
      });
      if (overlapping.length > 0) {
        return NextResponse.json(
          { error: 'maintenance_overlap', overlapping },
          { status: 409 }
        );
      }

      const created = await prisma.busMaintenance.create({
        data: {
          busId: id,
          startAt,
          endAt,
          reason: reason ?? null,
        },
        select: { id: true, startAt: true, endAt: true, reason: true },
      });

      // AC4 — soft warning on maintenance-vs-trip overlap (insert still happens).
      const conflictingTrips = await findTripOverlaps({
        busId: id,
        startAt,
        endAt,
      });

      return NextResponse.json(
        { maintenance: created, conflictingTrips },
        { status: 201 }
      );
    })
  );

  return wrappedHandler(req);
}
