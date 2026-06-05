/**
 * GET /api/op/manifest/:tripId — boarding manifest (Issue 014 AC6, AC7).
 *
 * AC6: NO seat-number column in output.
 * AC7: generatedAt timestamp returned for "Last updated" display.
 * Manual + cash bookings flagged in output.
 * Tenant-isolated via Trip.operatorId.
 *
 * 404 if trip not found or cross-operator.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { getManifest } from '@/lib/booking';

type RouteContext = { params: Promise<{ tripId: string }> };

export async function GET(req: NextRequest, routeCtx: RouteContext): Promise<Response> {
  const { tripId } = await routeCtx.params;

  return withErrorHandler(
    requireOperatorAuth({ staffTripScope: () => tripId })(async (_req: NextRequest, ctx: OperatorAuthContext) => {
      const manifest = await getManifest(ctx.operatorId, tripId);
      if (!manifest) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      return NextResponse.json(manifest);
    })
  )(req);
}
