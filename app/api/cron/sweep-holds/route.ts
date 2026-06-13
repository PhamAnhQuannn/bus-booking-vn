/**
 * GET /api/cron/sweep-holds
 *
 * Invoked every minute by Vercel Cron (see vercel.json).
 * Secures via CRON_SECRET header check (Vercel injects this automatically).
 *
 * Modes (controlled by HOLD_SWEEPER_MODE env var):
 *   "count"  — count expired active holds, log and return without mutation (safe default)
 *   "update" — mark up to 500 expired-but-still-active holds as status='expired'
 *              Uses LIMIT + FOR UPDATE SKIP LOCKED for safe concurrent execution.
 *
 * Returns: { mode, expiredCount } on success, 401 on auth failure.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/core/db/client';
import { runJob } from '@/lib/jobs';
import { expireHolds } from '@/lib/jobs';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  // Authenticate via CRON_SECRET (Vercel sets Authorization: Bearer <secret>)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const mode = process.env.HOLD_SWEEPER_MODE ?? 'count';

  if (mode === 'count') {
    // Count-only mode: read without mutation. No JobRunLog row — this path
    // never mutates, so the advisory-lock + audit wrapper is unnecessary.
    const count = await prisma.hold.count({
      where: {
        status: 'active',
        expiresAt: { lt: new Date() },
      },
    });
    logger.info({ mode, expiredCount: count }, 'sweep-holds: count mode');
    return NextResponse.json({ mode, expiredCount: count });
  }

  // "update" mode: expire holds under the advisory lock + JobRunLog wrapper.
  const result = await runJob('hold-expiry', expireHolds);
  logger.info({ mode, ...result }, 'sweep-holds: update mode');
  return NextResponse.json({ mode, expiredCount: result.rowsAffected, status: result.status });
}
