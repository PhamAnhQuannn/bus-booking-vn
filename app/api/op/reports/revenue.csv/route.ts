/**
 * GET /api/op/reports/revenue.csv
 *
 * Returns a UTF-8 BOM CSV of the operator's revenue data for the requested date range.
 * The browser triggers a file download via the Content-Disposition: attachment header.
 *
 * Query params:
 *   dateFrom  YYYY-MM-DD (required)
 *   dateTo    YYYY-MM-DD (required)
 *   routeId   string     (optional)
 *
 * Returns 200 text/csv on success.
 * Returns 400 if dateFrom/dateTo are missing or malformed.
 *
 * I7-exempt: operator-side reporting endpoint.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { getBookingRevenueRows } from '@/lib/ledger/getBookingRevenueRows';
import { buildBookingRevenueCsv } from '@/lib/ledger/buildBookingRevenueCsv';

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

  // AC2 (PRD story 57): CSV emits per-booking rows, not per-trip aggregates.
  // getRevenueReport (per-trip aggregates) backs the JSON report (story 56) — do not use here.
  const rows = await getBookingRevenueRows({
    operatorId: ctx.operatorId,
    dateFrom: parsed.data.dateFrom,
    dateTo: parsed.data.dateTo,
    routeId: parsed.data.routeId,
  });

  const csv = buildBookingRevenueCsv(rows);
  const filename = `revenue-${parsed.data.dateFrom}-${parsed.data.dateTo}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export const GET = requireOperatorAuth({})(getHandler);
