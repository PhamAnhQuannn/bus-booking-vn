/**
 * POST /api/op/trips/[id]/block-seats — set blockedSeats (Issue 013 AC2).
 *
 * 422 block_exceeds_available when blockedSeats > availableSeats
 * 404 not_found for cross-op trips
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { blockSeats } from '@/lib/trips/blockSeats';
import { TripServiceError } from '@/lib/trips/errors';
import { BlockSeatsSchema } from '@/lib/validation/trip';

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

      const parsed = BlockSeatsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'validation_failed', issues: parsed.error.issues }, { status: 422 });
      }

      try {
        const trip = await blockSeats(authCtx.operatorId, id, parsed.data.blockedSeats);
        return NextResponse.json({ trip });
      } catch (e) {
        if (e instanceof TripServiceError) {
          if (e.code === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
          if (e.code === 'block_exceeds_available') {
            return NextResponse.json({ error: 'block_exceeds_available' }, { status: 422 });
          }
        }
        throw e;
      }
    })
  );
  return wrappedHandler(req);
}
