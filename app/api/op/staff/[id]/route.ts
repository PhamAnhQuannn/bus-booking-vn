/**
 * PATCH /api/op/staff/[id] — rename a staff member (Issue 017).
 *
 * Body { name }. Returns 200 { staff }. 404 not_found (cross-operator / not staff).
 * adminOnly.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { updateStaff } from '@/lib/staff';
import { StaffServiceError } from '@/lib/staff';
import { UpdateStaffSchema } from '@/lib/core/validation/staff';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({ adminOnly: true })(async (request: NextRequest, authCtx: OperatorAuthContext) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
      }

      const parsed = UpdateStaffSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 });
      }

      try {
        const staff = await updateStaff({ operatorId: authCtx.operatorId, staffId: id, name: parsed.data.name });
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
