/**
 * POST /api/admin/finance/fee/global (Issue 068)
 *
 * Admin sets the GLOBAL platform-fee default. Body: { ratePpm:int (0..200000) }.
 * Reuses setGlobalFee — inserts a NEW effective-dated FeeConfig row with
 * operatorId=null (never edits in place — Issue 013), closes the prior open global
 * row, writes the audit row in-tx. 200 { feeConfigId }. Bad rate → 422.
 *
 * Per-operator overrides live at /api/admin/operators/[id]/fee-override (067) — NOT
 * duplicated here.
 *
 * Finance auth via financeRoute. actor = `admin:<ctx.adminId>`.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { setGlobalFee, GlobalFeeError } from '@/lib/ledger/setGlobalFee';
import { financeRoute, readJsonBody } from '../../_shared';

const bodySchema = z.object({ ratePpm: z.number().int() });

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.res;

  const body = bodySchema.safeParse(parsed.body);
  if (!body.success) {
    return NextResponse.json({ error: 'INVALID_RATE' }, { status: 422 });
  }

  try {
    const { feeConfigId } = await setGlobalFee(undefined, {
      ratePpm: body.data.ratePpm,
      actor: `admin:${ctx.adminId}`,
    });
    return NextResponse.json({ feeConfigId });
  } catch (e) {
    if (e instanceof GlobalFeeError) {
      return NextResponse.json({ error: 'INVALID_RATE' }, { status: 422 });
    }
    throw e;
  }
}

export const POST = financeRoute(handler);
