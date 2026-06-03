/**
 * POST /api/op/staff/[id]/assign-service — assign a staff member to a trip (Issue 017).
 *
 * Body { tripId }. Returns 200 { staff }. Single-trip rule: re-assigning replaces
 * the prior assignedTripId (idempotent). adminOnly.
 *
 * Status codes (from AC verbatim):
 *   - 404 not_found        — staff missing / cross-operator / not staff
 *   - 404 trip_not_found   — trip missing / owned by another operator
 *   - 422 trip_not_assignable — trip status cancelled/departed/completed
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { assignService } from '@/lib/staff/assignService';
import { StaffServiceError } from '@/lib/staff/errors';
import { AssignServiceSchema } from '@/lib/core/validation/staff';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({ adminOnly: true })(async (request: NextRequest, authCtx: OperatorAuthContext) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
      }

      const parsed = AssignServiceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 });
      }

      try {
        const staff = await assignService({
          operatorId: authCtx.operatorId,
          staffId: id,
          tripId: parsed.data.tripId,
        });
        return NextResponse.json({ staff });
      } catch (e) {
        if (e instanceof StaffServiceError) {
          if (e.code === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
          if (e.code === 'trip_not_found') return NextResponse.json({ error: 'trip_not_found' }, { status: 404 });
          if (e.code === 'trip_not_assignable') return NextResponse.json({ error: 'trip_not_assignable' }, { status: 422 });
        }
        throw e;
      }
    })
  );
  return wrappedHandler(req);
}
