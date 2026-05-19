/**
 * POST /api/op/bookings/:id/escalation — flag booking with escalation note (Issue 014).
 *
 * Body: { note: string }
 * Returns updated booking DTO with escalation fields set.
 *
 * 404 on cross-operator or missing booking.
 * 422 on validation failure.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { EscalationSchema } from '@/lib/booking/schemas';
import { recordEscalation } from '@/lib/booking/recordEscalation';
import { BookingServiceError } from '@/lib/booking/recordCallOutcome';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, routeCtx: RouteContext): Promise<Response> {
  const { id } = await routeCtx.params;

  return withErrorHandler(
    requireOperatorAuth({})(async (request: NextRequest, ctx: OperatorAuthContext) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
      }

      const parsed = EscalationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'validation_failed', issues: parsed.error.issues },
          { status: 422 }
        );
      }

      try {
        const booking = await recordEscalation(ctx.operatorId, id, parsed.data.note);
        return NextResponse.json({ booking });
      } catch (err) {
        if (err instanceof BookingServiceError && err.code === 'not_found') {
          return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }
        throw err;
      }
    })
  )(req);
}
