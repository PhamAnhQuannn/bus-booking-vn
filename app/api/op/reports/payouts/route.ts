/**
 * GET /api/op/reports/payouts
 *
 * Returns all payout records for the authenticated operator, newest first.
 *
 * Returns 200 JSON { rows: PayoutReportRow[] } on success.
 *
 * I7-exempt: operator-side reporting endpoint.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { getPayoutReport } from '@/lib/payouts/getPayoutReport';

async function getHandler(_req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  const rows = await getPayoutReport({ operatorId: ctx.operatorId });
  return NextResponse.json({ rows });
}

export const GET = requireOperatorAuth({})(getHandler);
