/**
 * POST /api/admin/operators/[id]/fee-override (Issue 067, AC3 + AC4)
 *
 * Sets a per-operator platform-fee override. FINANCE or SUPER_ADMIN only (AC4);
 * PRIVILEGED, so requireStepUp composes on top (AC3 — fresh step-up token).
 *
 * Body: { ratePpm: int } (parts-per-million; 60000 = 6%). actor = `admin:<id>`.
 * Inserts a NEW effective-dated FeeConfig row (never edits in place — Issue 013)
 * via setOperatorFeeOverride. 200 { feeConfigId }. Bad body / invalid rate → 422.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth';
import { requireStepUp } from '@/lib/auth';
import { setOperatorFeeOverride, FeeOverrideError } from '@/lib/ledger/setOperatorFeeOverride';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { operatorIdFromUrl } from '../_shared';

const bodySchema = z.object({ ratePpm: z.number().int() });

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
    // Bad/missing ratePpm is a validation failure → 422 (AC: validation error→422).
    return NextResponse.json({ error: 'INVALID_RATE' }, { status: 422 });
  }

  try {
    const { feeConfigId } = await setOperatorFeeOverride(undefined, {
      operatorId,
      ratePpm: parsed.data.ratePpm,
      actor: `admin:${ctx.adminId}`,
    });
    return NextResponse.json({ feeConfigId });
  } catch (e) {
    if (e instanceof FeeOverrideError) {
      return NextResponse.json({ error: 'INVALID_RATE' }, { status: 422 });
    }
    throw e;
  }
}

export const POST = withErrorHandler(
  requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] })(
    requireStepUp(handler)
  ) as (req: NextRequest) => Promise<Response>
);
