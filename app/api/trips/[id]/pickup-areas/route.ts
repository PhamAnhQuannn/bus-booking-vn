/**
 * GET /api/trips/[id]/pickup-areas — the trip's enabled pickup areas (Issue 107).
 *
 * PUBLIC (booking is pre-auth): returns { areaId, label, kind } for this trip's
 * TripPickupArea rows so the booking form can render the pickup radio grouped by
 * kind (Issue 110). areaId is the OperatorPickupArea id (matches Booking.pickupAreaId).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/core/db/client';
import { withErrorHandler } from '@/lib/withErrorHandler';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, routeCtx: RouteContext): Promise<Response> {
  const { id } = await routeCtx.params;

  return withErrorHandler(async () => {
    const rows = await prisma.tripPickupArea.findMany({
      where: { tripId: id },
      orderBy: { displayOrder: 'asc' },
      select: { operatorPickupAreaId: true, label: true, kind: true },
    });
    const areas = rows.map((r) => ({ areaId: r.operatorPickupAreaId, label: r.label, kind: r.kind }));
    return NextResponse.json({ areas });
  })(req);
}
