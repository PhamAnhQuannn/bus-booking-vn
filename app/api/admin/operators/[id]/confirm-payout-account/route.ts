/**
 * POST /api/admin/operators/[id]/confirm-payout-account (Issue 065)
 *
 * RECORDS an admin's manual confirmation that the operator's payout account has
 * been checked. The actual payout-account-ownership VERIFY mechanism (micro-deposit
 * / name-match) lands in Wave 5 (Issue 078); here we only capture the human
 * confirmation as an AdminAuditLog row so there is a trail until 078 ships.
 *
 * Money-adjacent, so requireStepUp is composed on top (fresh re-auth required),
 * same as approve. SUPER_ADMIN + TOTP-verified. No status transition, no body.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { requireStepUp } from '@/lib/auth/requireStepUp';
import { writeAdminAuditLog } from '@/lib/audit/adminAuditLog';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { operatorIdFromUrl } from '../_shared';

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const operatorId = operatorIdFromUrl(req);
  if (!operatorId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  // Wave 5 (078): real verify flow records the verified account here. For now we
  // only capture the admin's manual confirmation in the audit trail.
  await writeAdminAuditLog(prisma, {
    actor: `admin:${ctx.adminId}`,
    action: 'confirm-payout-account',
    target: operatorId,
    argsRedacted: JSON.stringify({ confirmed: true }),
  });

  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandler(
  requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })(
    requireStepUp(handler)
  ) as (req: NextRequest) => Promise<Response>
);
