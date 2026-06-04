/**
 * POST /api/admin/operators/[id]/reject (Issue 065)
 *
 * Moves an operator UNDER_REVIEW → REJECTED with a required reason. SUPER_ADMIN +
 * TOTP-verified. Body: { reason: string (min 1) }. The reason is persisted on the
 * Operator (shown on resubmit) and recorded in the audit row by the transition
 * service. Maps bad body→400, illegal_transition→422, operator_not_found→404.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth';
import { transitionOperatorStatus } from '@/lib/onboarding/operatorStatus';
import { OperatorStatusError } from '@/lib/onboarding/errors';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { operatorIdFromUrl, mapOperatorStatusError } from '../_shared';

const bodySchema = z.object({ reason: z.string().min(1) });

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const operatorId = operatorIdFromUrl(req);
  if (!operatorId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  try {
    await transitionOperatorStatus({
      operatorId,
      to: 'REJECTED',
      reason: parsed.data.reason,
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
