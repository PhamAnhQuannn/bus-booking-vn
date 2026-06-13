/**
 * GET /api/cron/charter-expiry
 *
 * Invoked hourly by Vercel Cron (see vercel.json). Secures via CRON_SECRET header
 * (Vercel injects `Authorization: Bearer <secret>`).
 *
 * Reroutes timed-out charter leads back to admin review (Issue 086):
 *   - ASSIGNED_DIRECT past acceptByAt → ADMIN_REVIEW (direct-assign timeout)
 *   - PUBLISHED past claimByAt        → EXPIRED → ADMIN_REVIEW (pool expiry)
 *
 * Runs under the advisory-lock + JobRunLog wrapper (Issue 019/043 machinery) with
 * the unique lock key 'charter-sweep', so two overlapping ticks cannot race — a
 * concurrent tick that finds the lock held returns { status: 'skipped_locked',
 * rowsAffected: 0 } without re-sweeping. Per-row SELECT … FOR UPDATE SKIP LOCKED
 * + the transition's own row lock guard against racing live operator actions.
 *
 * Returns: { rowsAffected, status } on success, 401 on auth failure, 500 on error.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { runJob } from '@/lib/jobs';
import { charterExpirySweeper } from '@/lib/jobs';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  // Authenticate via CRON_SECRET (Vercel sets Authorization: Bearer <secret>)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const result = await runJob('charter-sweep', charterExpirySweeper);
    logger.info(result, 'charter-expiry: cron run complete');
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, 'charter-expiry: cron run failed');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
