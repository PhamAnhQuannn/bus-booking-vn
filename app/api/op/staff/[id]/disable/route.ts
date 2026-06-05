/**
 * POST /api/op/staff/[id]/disable — deactivate a staff member (Issue 017).
 *
 * Sets disabledAt and revokes all of the staff member's sessions atomically.
 * Idempotent: re-disabling an already-disabled staff member is a 200 no-op.
 * Returns 200 { staff }. 404 not_found (cross-operator / not staff). adminOnly.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { disableStaff } from '@/lib/staff';
import { StaffServiceError } from '@/lib/staff';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({ adminOnly: true })(async (_request: NextRequest, authCtx: OperatorAuthContext) => {
      try {
        const staff = await disableStaff({ operatorId: authCtx.operatorId, staffId: id });
        return NextResponse.json({ staff });
      } catch (e) {
        if (e instanceof StaffServiceError && e.code === 'not_found') {
          return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }
        throw e;
      }
    })
  );
  return wrappedHandler(req);
}
