/**
 * POST /api/admin/finance/ledger/adjustment (Issue 068)
 *
 * Admin records a MANUAL operator-balance adjustment (signed VND minor units).
 * Body: { operatorId, amountMinor:int (≠0), reason:string.min(1) }. A missing/empty
 * reason or a non-integer amount → 422. Reuses addManualAdjustment (which mints a
 * unique sourceEventId per call + writes the audit row in-tx).
 *
 * Finance auth via financeRoute. actor = `admin:<ctx.adminId>`.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { addManualAdjustment, ManualAdjustmentError } from '@/lib/ledger/addManualAdjustment';
import { financeRoute, readJsonBody } from '../../_shared';

const bodySchema = z.object({
  operatorId: z.string().min(1),
  amountMinor: z.number().int(),
  reason: z.string().min(1),
});

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.res;

  const body = bodySchema.safeParse(parsed.body);
  if (!body.success) {
    // Missing reason / non-integer amount / missing operatorId → validation 422.
    return NextResponse.json({ error: 'INVALID' }, { status: 422 });
  }

  try {
    const { ledgerEntryId } = await addManualAdjustment(undefined, {
      operatorId: body.data.operatorId,
      amountMinor: body.data.amountMinor,
      reason: body.data.reason,
      actor: `admin:${ctx.adminId}`,
    });
    return NextResponse.json({ ledgerEntryId });
  } catch (e) {
    if (e instanceof ManualAdjustmentError) {
      return NextResponse.json({ error: 'INVALID' }, { status: 422 });
    }
    throw e;
  }
}

export const POST = financeRoute(handler);
