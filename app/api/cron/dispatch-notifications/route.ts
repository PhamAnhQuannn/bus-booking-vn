/**
 * GET /api/cron/dispatch-notifications
 *
 * Invoked on a short interval by Vercel Cron (see vercel.json).
 * Secures via CRON_SECRET header check (Vercel injects this automatically).
 *
 * Delivers due NotificationLog rows (status pending/failed, attemptCount <
 * MAX_ATTEMPTS, nextAttemptAt/scheduledFor due) through the channel adapters
 * with exponential backoff (Issue 058). Runs under the advisory-lock +
 * JobRunLog wrapper (lib/jobs/runJob + withAdvisoryLock) with a NEW lock key
 * 'notify-dispatch' so two overlapping ticks cannot double-claim — a concurrent
 * tick that finds the lock held returns { status: 'skipped_locked',
 * rowsAffected: 0 } without re-running. FOR UPDATE SKIP LOCKED inside the claim
 * query is belt-and-suspenders against a manual trigger racing a scheduled tick.
 *
 * Returns: { rowsAffected, status } on success, 401 on auth failure, 500 on error.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { runJob } from '@/lib/jobs';
import { dispatchNotifications } from '@/lib/jobs';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  // Authenticate via CRON_SECRET (Vercel sets Authorization: Bearer <secret>)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const result = await runJob('notify-dispatch', dispatchNotifications);
    logger.info(result, 'dispatch-notifications: cron run complete');
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, 'dispatch-notifications: cron run failed');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
