/**
 * GET /api/cron/complete-trips
 *
 * Invoked every 5 minutes by Vercel Cron (see vercel.json).
 * Secures via CRON_SECRET header check (Vercel injects this automatically).
 *
 * Completes departed trips whose journey duration has elapsed, creating the
 * aggregate Payout row per trip. Runs under the advisory-lock + JobRunLog
 * wrapper (Issue 019).
 *
 * Returns: { rowsAffected, status } on success, 401 on auth failure.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { runJob } from '@/lib/jobs/runJob';
import { autoCompleteTrips } from '@/lib/jobs/autoCompleteTrips';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const result = await runJob('trip-complete', autoCompleteTrips);
    logger.info(result, 'complete-trips: cron run complete');
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, 'complete-trips: cron run failed');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
