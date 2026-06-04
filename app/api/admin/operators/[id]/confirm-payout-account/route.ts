/**
 * POST /api/admin/operators/[id]/confirm-payout-account (Issue 065 → made REAL in 078)
 *
 * Marks the operator's payout account VERIFIED via confirmPayoutAccountOwnership
 * (Issue 078) — sets verifiedAt=now + verifyMethod, and writes the
 * 'verify-payout-account' AdminAuditLog row. The payout rail (withdrawal + sweep)
 * only sends to a verified account, so this is the gate that arms an operator's
 * payouts.
 *
 * Method comes from the body (`{ method?: 'name_match' | 'micro_deposit' }`),
 * defaulting to 'name_match' (the implemented method — the admin confirms the
 * name-match signal surfaced in the approvals queue). 422 when the operator has no
 * registered payout account.
 *
 * Money-adjacent, so requireStepUp is composed on top (fresh re-auth required),
 * same as approve. SUPER_ADMIN + TOTP-verified.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/core/db/client';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth';
import { requireStepUp } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { confirmPayoutAccountOwnership, PayoutVerifyError } from '@/lib/onboarding/payoutVerify';
import { operatorIdFromUrl } from '../_shared';

const ConfirmSchema = z.object({
  method: z.enum(['name_match', 'micro_deposit']).optional(),
});

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const operatorId = operatorIdFromUrl(req);
  if (!operatorId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  // Body is optional (an empty POST defaults method to name_match). Tolerate an
  // absent/non-JSON body, but reject a malformed method value.
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed', issues: parsed.error.issues }, { status: 422 });
  }

  try {
    await confirmPayoutAccountOwnership(prisma, {
      operatorId,
      method: parsed.data.method ?? 'name_match',
      actor: `admin:${ctx.adminId}`,
    });
  } catch (e) {
    if (e instanceof PayoutVerifyError && e.code === 'payout_account_not_found') {
      return NextResponse.json({ error: 'PAYOUT_ACCOUNT_NOT_FOUND' }, { status: 422 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandler(
  requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })(
    requireStepUp(handler)
  ) as (req: NextRequest) => Promise<Response>
);
