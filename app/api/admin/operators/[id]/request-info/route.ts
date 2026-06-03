/**
 * POST /api/admin/operators/[id]/request-info (Issue 065)
 *
 * NOTE-ONLY action: the S05 state machine has NO request-info edge, so this does
 * NOT change the operator's status (it stays UNDER_REVIEW). It records the admin's
 * note in the audit log and enqueues a notification telling the operator what's
 * missing — see lib/onboarding/requestOperatorInfo.ts. SUPER_ADMIN + TOTP-verified.
 *
 * Body: { note: string (min 1) }. Maps bad body→400, operator_not_found→404.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { requestOperatorInfo } from '@/lib/onboarding/requestOperatorInfo';
import { OperatorStatusError } from '@/lib/onboarding/errors';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { operatorIdFromUrl, mapOperatorStatusError } from '../_shared';

const bodySchema = z.object({ note: z.string().min(1) });

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
    await requestOperatorInfo({
      operatorId,
      note: parsed.data.note,
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
