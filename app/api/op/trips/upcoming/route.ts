/**
 * GET /api/op/trips/upcoming — upcoming trips for operator (Issue 014).
 *
 * Query params: routeId, limit, cursor
 * Returns scheduled+departed trips sorted by departureAt ASC.
 * Tenant-isolated via Trip.operatorId.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { listUpcomingForOperator, ListUpcomingParamsSchema } from '@/lib/trips/listUpcomingForOperator';

export const GET = withErrorHandler(
  requireOperatorAuth({})(async (req: NextRequest, ctx: OperatorAuthContext) => {
    const url = new URL(req.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());

    const parsed = ListUpcomingParamsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_failed', issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const result = await listUpcomingForOperator(ctx.operatorId, parsed.data);
    return NextResponse.json(result);
  })
);
