/**
 * POST /api/admin/finance/payouts/[id]/retry (Issue 068)
 *
 * Admin manually retries a FAILED payout. Reuses retryPayout (Issue 050) which
 * SELECT-FOR-UPDATE-serialises the row and only transitions failed→processing
 * (discriminated result, not a thrown sentinel — Issue 013).
 *
 * Finance auth: requireAdminAuth({ requireTotp, role:[SUPER_ADMIN,FINANCE] }) +
 * requireStepUp (financeRoute). actor = `admin:<ctx.adminId>`. Audited.
 *
 * retryPayout needs the operatorId for its cross-tenant IDOR guard; the admin acts
 * across all operators, so we resolve the payout's own operatorId first and pass
 * it through (the guard then always matches — the IDOR guard is for the operator-
 * facing caller; here the admin is authoritative). not_found → 404, not_failed → 422.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import type { AdminAuthContext } from '@/lib/auth';
import { retryPayout } from '@/lib/ledger/retryPayout';
import { writeAdminAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/core/db/client';
import { financeRoute, payoutIdFromUrl } from '../../../_shared';

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const payoutId = payoutIdFromUrl(req);
  if (!payoutId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  // Resolve the payout's operatorId so retryPayout's tenant guard matches (the
  // admin is authoritative across operators). Missing row → 404.
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    select: { operatorId: true },
  });
  if (!payout) {
    return NextResponse.json({ error: 'PAYOUT_NOT_FOUND' }, { status: 404 });
  }

  const result = await retryPayout({ payoutId, operatorId: payout.operatorId });

  if (!result.ok) {
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'PAYOUT_NOT_FOUND' }, { status: 404 });
    }
    // not_failed (or the unreachable wrong_operator) → not a retryable state.
    return NextResponse.json({ error: 'NOT_RETRYABLE' }, { status: 422 });
  }

  await writeAdminAuditLog(prisma, {
    actor: `admin:${ctx.adminId}`,
    action: 'payout-retry',
    target: payoutId,
    argsRedacted: JSON.stringify({ operatorId: payout.operatorId }),
  });

  return NextResponse.json({ ok: true, status: result.payout.status });
}

export const POST = financeRoute(handler);
