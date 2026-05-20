/**
 * GET /api/cron/close-sales
 *
 * Invoked every minute by Vercel Cron (see vercel.json).
 * Secures via CRON_SECRET header check (Vercel injects this automatically).
 *
 * Closes ticket sales on scheduled trips whose departure time has arrived.
 * Runs under the advisory-lock + JobRunLog wrapper (Issue 019).
 *
 * Returns: { rowsAffected, status } on success, 401 on auth failure.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { runJob } from '@/lib/jobs/runJob';
import { autoCloseSales } from '@/lib/jobs/autoCloseSales';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const result = await runJob('sales-close', autoCloseSales);
    logger.info(result, 'close-sales: cron run complete');
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, 'close-sales: cron run failed');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
