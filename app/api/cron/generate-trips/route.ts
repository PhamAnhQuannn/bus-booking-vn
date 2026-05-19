/**
 * GET /api/cron/generate-trips
 *
 * Invoked daily by Vercel Cron (see vercel.json).
 * Secures via CRON_SECRET header check (Vercel injects this automatically).
 *
 * Generates Trip rows for the next 14 days from all active RecurringTripTemplates.
 * Idempotent — already-existing trips are skipped and logged to RecurringGenerationLog.
 *
 * Returns: { generated, skipped, failed } on success, 401 on auth failure.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { generateTripsFromTemplates } from '@/lib/trips/generateFromTemplate';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  // Authenticate via CRON_SECRET (Vercel sets Authorization: Bearer <secret>)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const result = await generateTripsFromTemplates();
    logger.info(result, 'generate-trips: cron run complete');
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, 'generate-trips: cron run failed');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
