/**
 * POST /api/admin/finance/refunds/[id]/mark-paid (#833)
 *
 * Admin confirms they made the manual bank transfer for a refund recorded on the no-PSP
 * rail: RefundObligation 'manual_pending' → 'done' + manualPaidAt + manualBankRef. The ledger
 * legs were already written by refundOut, so this is a status close-out only.
 *
 * Body: { bankRef: string } — the bank transaction reference of the transfer (1–100 chars).
 * 200 { ok:true } · 400 INVALID (no id / bad JSON) · 422 INVALID (bad body) ·
 * 404 REFUND_NOT_FOUND · 422 NOT_OWED (not in 'manual_pending' — already paid, or never manual).
 *
 * Finance auth via financeRoute (TOTP + FINANCE/SUPER_ADMIN + step-up). Audited.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { AdminAuthContext } from '@/lib/auth';
import { writeAdminAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/core/db/client';
import { markManualRefundPaid } from '@/lib/payment';
import { financeRoute, idAfterSegment, readJsonBody } from '../../../_shared';

const bodySchema = z.object({ bankRef: z.string().trim().min(1).max(100) });

/** Request-boundary clock (kept out of the service so tests can pin it there). */
function requestNow(): Date {
  return new Date();
}

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const obligationId = idAfterSegment(req, 'refunds');
  if (!obligationId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.res;
  const body = bodySchema.safeParse(parsed.body);
  if (!body.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 422 });
  }

  const result = await markManualRefundPaid({
    obligationId,
    bankRef: body.data.bankRef,
    now: requestNow(),
  });
  if (!result.ok) {
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'REFUND_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: 'NOT_OWED' }, { status: 422 });
  }

  await writeAdminAuditLog(prisma, {
    actor: `admin:${ctx.adminId}`,
    action: 'manual-refund-mark-paid',
    target: obligationId,
    argsRedacted: JSON.stringify({ bankRef: body.data.bankRef }),
  });

  return NextResponse.json({ ok: true });
}

export const POST = financeRoute(handler);
