/**
 * GET /api/cron/send-reminders
 *
 * Invoked every 15 minutes by Vercel Cron (see vercel.json).
 * Secures via CRON_SECRET header check (Vercel injects this automatically).
 *
 * Sends the 24h pre-departure SMS reminder once per eligible booking. Runs
 * under the advisory-lock + JobRunLog wrapper (Issue 019).
 *
 * Returns: { rowsAffected, status } on success, 401 on auth failure.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { runJob } from '@/lib/jobs/runJob';
import { sendReminders } from '@/lib/jobs/sendReminders';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const result = await runJob('reminder-24h', sendReminders);
    logger.info(result, 'send-reminders: cron run complete');
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, 'send-reminders: cron run failed');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
