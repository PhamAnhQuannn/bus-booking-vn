/**
 * POST /api/admin/operators/[id]/suspend (Issue 067, AC1)
 *
 * Moves an operator APPROVED → SUSPENDED. PRIVILEGED action: composes requireStepUp
 * ON TOP of requireAdminAuth({requireTotp, role:'SUPER_ADMIN'}) — the admin must
 * present a fresh step-up token (bb_admin_stepup). Missing/stale → 403
 * STEP_UP_REQUIRED (the client drives the step-up flow and retries).
 *
 * actor = `admin:<ctx.adminId>`. Maps illegal_transition→422, operator_not_found→404
 * (reuses _shared mapOperatorStatusError + operatorIdFromUrl).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { requireStepUp } from '@/lib/auth/requireStepUp';
import { transitionOperatorStatus } from '@/lib/onboarding/operatorStatus';
import { OperatorStatusError } from '@/lib/onboarding/errors';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { operatorIdFromUrl, mapOperatorStatusError } from '../_shared';

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const operatorId = operatorIdFromUrl(req);
  if (!operatorId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  try {
    await transitionOperatorStatus({
      operatorId,
      to: 'SUSPENDED',
      actor: `admin:${ctx.adminId}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof OperatorStatusError) {
      return mapOperatorStatusError(e);
    }
    throw e;
  }
}

export const POST = withErrorHandler(
  requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })(
    requireStepUp(handler)
  ) as (req: NextRequest) => Promise<Response>
);
