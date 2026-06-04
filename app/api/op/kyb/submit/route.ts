/**
 * POST /api/op/kyb/submit (Issue 077)
 *
 * Operator-scoped. The operator explicitly submits their KYB application for
 * review: transition PENDING_REVIEW → UNDER_REVIEW via the Issue 045 service.
 * Doc UPLOAD alone does NOT change state — this route is the explicit submit.
 *
 * Errors:
 *   422 ILLEGAL_TRANSITION — not in PENDING_REVIEW (045 illegal_transition)
 *   404 OPERATOR_NOT_FOUND — 045 operator_not_found (defensive; JWT-scoped op)
 * Success: 200 { ok: true }
 *
 * Operator scope (operatorId) comes from the JWT context, never the body.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { submitForReview } from '@/lib/onboarding/kyb';
import { OperatorStatusError } from '@/lib/onboarding/errors';

async function postHandler(_req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  try {
    await submitForReview({
      operatorId: ctx.operatorId,
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
