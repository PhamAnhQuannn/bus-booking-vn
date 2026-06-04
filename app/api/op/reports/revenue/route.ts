/**
 * GET /api/op/reports/revenue
 *
 * Returns aggregated revenue data for the authenticated operator's trips.
 *
 * Query params:
 *   dateFrom  YYYY-MM-DD (required)
 *   dateTo    YYYY-MM-DD (required)
 *   routeId   string     (optional)
 *
 * Returns 200 JSON { rows: RevenueRow[] } on success.
 * Returns 400 if dateFrom/dateTo are missing or malformed.
 *
 * I7-exempt: operator-side reporting endpoint.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { getRevenueReport } from '@/lib/ledger/getRevenueReport';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const RevenueQuerySchema = z
  .object({
    dateFrom: z.string().regex(DATE_PATTERN, 'dateFrom must be YYYY-MM-DD'),
    dateTo: z.string().regex(DATE_PATTERN, 'dateTo must be YYYY-MM-DD'),
    routeId: z.string().optional(),
  })
  .refine((data) => data.dateFrom <= data.dateTo, {
    message: 'dateFrom must be <= dateTo',
    path: ['dateFrom'],
  });

async function getHandler(req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  const url = new URL(req.url);
  const raw = {
    dateFrom: url.searchParams.get('dateFrom') ?? undefined,
    dateTo: url.searchParams.get('dateTo') ?? undefined,
    routeId: url.searchParams.get('routeId') ?? undefined,
  };

  const parsed = RevenueQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const rows = await getRevenueReport({
    operatorId: ctx.operatorId,
    dateFrom: parsed.data.dateFrom,
    dateTo: parsed.data.dateTo,
    routeId: parsed.data.routeId,
  });

  return NextResponse.json({ rows });
}

export const GET = requireOperatorAuth({})(getHandler);
