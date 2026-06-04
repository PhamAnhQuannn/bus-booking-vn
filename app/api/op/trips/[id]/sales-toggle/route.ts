/**
 * POST /api/op/trips/[id]/sales-toggle — flip salesClosed (Issue 013 AC7).
 *
 * 404 not_found (cross-op)
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { salesToggle } from '@/lib/trips/salesToggle';
import { TripServiceError } from '@/lib/trips/errors';
import { SalesToggleSchema } from '@/lib/core/validation/trip';

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

      const parsed = SalesToggleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'validation_failed', issues: parsed.error.issues }, { status: 422 });
      }

      try {
        const trip = await salesToggle(authCtx.operatorId, id, parsed.data.salesClosed);
        return NextResponse.json({ trip });
      } catch (e) {
        if (e instanceof TripServiceError && e.code === 'not_found') {
          return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }
        throw e;
      }
    })
  );
  return wrappedHandler(req);
}
