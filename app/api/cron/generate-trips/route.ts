/**
 * GET /api/cron/generate-trips
 *
 * Invoked daily by Vercel Cron (see vercel.json).
 * Secures via CRON_SECRET header check (Vercel injects this automatically).
 *
 * Generates Trip rows for the next 14 days from all active RecurringTripTemplates.
 * Runs under the advisory-lock + JobRunLog wrapper (Issue 019 machinery, adopted
 * by Issue 043) so two overlapping ticks cannot race — a concurrent tick that
 * finds the lock held returns { status: 'skipped_locked', rowsAffected: 0 }
 * without re-running generation.
 *
 * Per-row idempotency inside generateTripsFromTemplates (partial unique on
 * recurringTemplateId, departureAt) is retained as defense-in-depth.
 *
 * Returns: { rowsAffected, status } on success, 401 on auth failure, 500 on error.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { runJob } from '@/lib/jobs/runJob';
import { generateTrips } from '@/lib/jobs/generateTrips';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  // Authenticate via CRON_SECRET (Vercel sets Authorization: Bearer <secret>)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const result = await runJob('trip-generate', generateTrips);
    logger.info(result, 'generate-trips: cron run complete');
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, 'generate-trips: cron run failed');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
