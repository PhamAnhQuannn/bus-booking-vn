/**
 * /api/op/trips — operator trip collection routes (Issue 013).
 *
 * GET  — list trips for operator (filterable by routeId, fromDate, toDate, status)
 * POST — create a one-off trip
 *        422 bus_in_maintenance (AC1)
 *        422 bus_deactivated
 *        409 bus_overlap (bus already runs an overlapping trip — I3 overlap-conflict)
 *        404 not_found (cross-op bus or route)
 *
 * Both gated by requireOperatorAuth (I7: /op/trips/** NOT in allowlist → JWT claim
 * requiresPasswordChange=true still gates access).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { createTrip } from '@/lib/trips/createTrip';
import { listTrips } from '@/lib/trips/getTrip';
import { TripServiceError } from '@/lib/trips/errors';
import { CreateTripSchema } from '@/lib/validation/trip';

async function getHandler(req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  const url = new URL(req.url);
  const routeId = url.searchParams.get('routeId') ?? undefined;
  const fromDate = url.searchParams.get('fromDate')
    ? new Date(url.searchParams.get('fromDate')!)
    : undefined;
  const toDate = url.searchParams.get('toDate')
    ? new Date(url.searchParams.get('toDate')!)
    : undefined;
  const status = url.searchParams.get('status') ?? undefined;

  const trips = await listTrips(ctx.operatorId, { routeId, fromDate, toDate, status });
  return NextResponse.json({ trips });
}

async function postHandler(req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = CreateTripSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed', issues: parsed.error.issues }, { status: 422 });
  }

  try {
    // I7-exempt: operator is the price authority for their own trips (AGENTS.md 2026-05-19 Issue 013)
    const trip = await createTrip({
      operatorId: ctx.operatorId,
      routeId: parsed.data.routeId,
      busId: parsed.data.busId,
      departureAt: parsed.data.departureAt,
      price: parsed.data.price,
      blockedSeats: parsed.data.blockedSeats,
    });
    return NextResponse.json({ trip }, { status: 201 });
  } catch (e) {
    if (e instanceof TripServiceError) {
      if (e.code === 'not_found') {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (e.code === 'bus_in_maintenance') {
        return NextResponse.json({ error: 'bus_in_maintenance' }, { status: 422 });
      }
      if (e.code === 'bus_deactivated') {
        return NextResponse.json({ error: 'bus_deactivated' }, { status: 422 });
      }
      if (e.code === 'bus_overlap') {
        // Bus already runs an overlapping trip — conflict (I3: overlap-conflict = 409).
        return NextResponse.json({ error: 'bus_overlap' }, { status: 409 });
      }
    }
    throw e;
  }
}

export const GET = withErrorHandler(requireOperatorAuth({})(getHandler));
export const POST = withErrorHandler(requireOperatorAuth({})(postHandler));
