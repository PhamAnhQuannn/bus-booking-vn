/**
 * POST /api/admin/finance/payouts/[id]/approve (Issue 068)
 *
 * Admin manually advances a `requested` payout to `processing` so the payout sweep
 * picks it up and pays it. There is no clean approve/process primitive in the 050
 * ledger layer, so this is a MINIMAL guarded nudge (per the issue's "thin status
 * nudge" fallback): a TOCTOU-safe requested→processing transition.
 *
 * TOCTOU-safe like retryPayout (Issue 011 Mistake Log): SELECT ... FOR UPDATE on
 * the Payout row inside $transaction (callback form for the raw-SQL tx handle;
 * CUIDs are TEXT, no ::uuid cast), then the update — both inside the lock so two
 * concurrent approves can't both advance the same row. Only `requested` payouts
 * are approvable; any other status → 422 NOT_APPROVABLE (discriminated result, not
 * a thrown sentinel — Issue 013). The sweep (S19) does the actual pay-out.
 *
 * Finance auth via financeRoute. actor = `admin:<ctx.adminId>`. Audited.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import type { AdminAuthContext } from '@/lib/auth';
import { writeAdminAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/core/db/client';
import { financeRoute, payoutIdFromUrl } from '../../../_shared';

type ApproveResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'not_requested' };

async function approvePayout(payoutId: string): Promise<ApproveResult> {
  return prisma.$transaction(async (tx) => {
    // Serialise concurrent approves on the same row. CUIDs are TEXT — no ::uuid cast.
    const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status FROM "Payout" WHERE id = ${payoutId} FOR UPDATE
    `;
    if (rows.length === 0) return { ok: false, error: 'not_found' };
    if (rows[0].status !== 'requested') return { ok: false, error: 'not_requested' };

    await tx.payout.update({
      where: { id: payoutId },
      data: { status: 'processing' },
    });
    return { ok: true };
  });
}

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const payoutId = payoutIdFromUrl(req);
  if (!payoutId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const result = await approvePayout(payoutId);
  if (!result.ok) {
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'PAYOUT_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: 'NOT_APPROVABLE' }, { status: 422 });
  }

  await writeAdminAuditLog(prisma, {
    actor: `admin:${ctx.adminId}`,
    action: 'payout-approve',
    target: payoutId,
    argsRedacted: null,
  });

  return NextResponse.json({ ok: true, status: 'processing' });
}

export const POST = financeRoute(handler);
