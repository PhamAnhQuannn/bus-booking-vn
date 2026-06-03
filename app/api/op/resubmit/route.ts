/**
 * POST /api/op/resubmit (Issue 079)
 *
 * Operator self-resubmit after a rejection. Transitions REJECTED → PENDING_REVIEW
 * via the Issue 045 service (the only legal source state — any other state is an
 * illegal edge → 422). The 045 PENDING_REVIEW branch clears rejectionReason and
 * the transition re-enqueues the under-review/pending notification (SMS + email,
 * per Issue 079 part A).
 *
 * Errors:
 *   422 ILLEGAL_TRANSITION — not in REJECTED (045 illegal_transition)
 *   404 OPERATOR_NOT_FOUND — 045 operator_not_found (defensive; JWT-scoped op)
 * Success: 200 { ok: true }
 *
 * Operator scope (operatorId) comes from the JWT context, never the body.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { transitionOperatorStatus } from '@/lib/onboarding/operatorStatus';
import { OperatorStatusError } from '@/lib/onboarding/errors';

async function postHandler(_req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  try {
    await transitionOperatorStatus({
      operatorId: ctx.operatorId,
      to: 'PENDING_REVIEW',
      actor: `operator:${ctx.operatorId}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof OperatorStatusError) {
      if (e.code === 'illegal_transition') {
        return NextResponse.json({ error: 'ILLEGAL_TRANSITION' }, { status: 422 });
      }
      if (e.code === 'operator_not_found') {
        return NextResponse.json({ error: 'OPERATOR_NOT_FOUND' }, { status: 404 });
      }
    }
    throw e;
  }
}

export const POST = withErrorHandler(
  requireOperatorAuth({})(postHandler) as (req: NextRequest) => Promise<Response>
);
