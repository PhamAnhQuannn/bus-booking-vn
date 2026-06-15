/**
 * GET /api/cron/send-reminders
 *
 * Invoked every 15 minutes by Vercel Cron (see vercel.json).
 * Secures via CRON_SECRET header check (Vercel injects this automatically).
 *
 * Sends the 24h pre-departure SMS reminder once per eligible booking.
 * Uses claim-then-dispatch (B-07): sendReminders() manages its own
 * advisory lock for the claim phase, then dispatches SMS outside the tx.
 * JobRunLog is written here (mirrors runJob contract).
 *
 * Returns: { rowsAffected, status } on success, 401 on auth failure.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/core/db/client';
import { sendReminders } from '@/lib/jobs';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const startedAt = new Date();

  try {
    const result = await sendReminders();
    await prisma.jobRunLog.create({
      data: {
        jobName: 'reminder-24h',
        startedAt,
        endedAt: new Date(),
        status: result.status,
        rowsAffected: result.rowsAffected,
      },
    });
    logger.info(result, 'send-reminders: cron run complete');
    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await prisma.jobRunLog.create({
      data: {
        jobName: 'reminder-24h',
        startedAt,
        endedAt: new Date(),
        status: 'failed',
        rowsAffected: 0,
        errorMessage,
      },
    });
    logger.error({ err }, 'send-reminders: cron run failed');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
