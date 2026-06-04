/**
 * POST /api/admin/operators/[id]/under-review (Issue 065)
 *
 * Moves an operator PENDING_REVIEW → UNDER_REVIEW. SUPER_ADMIN + TOTP-verified.
 * Approvals are a SUPER_ADMIN action in this slice; if a dedicated approver role
 * is wanted later, widen the `role` set here (and on the sibling action routes).
 *
 * actor = `admin:<ctx.adminId>` so the transition service writes an AdminAuditLog
 * row. Maps OperatorStatusError('illegal_transition')→422, operator_not_found→404
 * (mirrors reset-totp's path parse + service-error mapping).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth';
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
      to: 'UNDER_REVIEW',
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
  requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })(handler) as (
    req: NextRequest
  ) => Promise<Response>
);
