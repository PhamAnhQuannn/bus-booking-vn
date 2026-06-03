/**
 * GET /api/cron/retention
 *
 * Invoked daily by Vercel Cron (see vercel.json — 03:00). Secures via CRON_SECRET
 * (Vercel injects `Authorization: Bearer <secret>`).
 *
 * Enforces the two Issue 090 retention windows (lib/account/retentionPolicy.ts):
 *   - GUEST PII (365d): scrub the guest buyer name/phone/email snapshot on bookings
 *     whose trip departed > 1 year ago. Money/audit columns retained (S04).
 *   - KYB DOCS (90d): purge the storage object for KybDocuments of REJECTED/SUSPENDED
 *     operators uploaded > 90 days ago; stamp purgedAt.
 *
 * Runs under the advisory-lock + JobRunLog wrapper (Issue 019/043) with the unique
 * lock key 'retention-sweep' (verified no collision with the 9 existing keys:
 * hold-expiry, sales-close, trip-generate, charter-sweep, notify-dispatch,
 * ticket-pdf, trip-complete, payout-processor, reminder-24h), so two overlapping
 * ticks cannot race — a concurrent tick that finds the lock held returns
 * { status: 'skipped_locked', rowsAffected: 0 }.
 *
 * Returns: { rowsAffected, status } on success, 401 on auth failure, 500 on error.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { runJob } from '@/lib/jobs/runJob';
import { retentionSweeper } from '@/lib/jobs/retentionSweeper';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  // Authenticate via CRON_SECRET (Vercel sets Authorization: Bearer <secret>)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const result = await runJob('retention-sweep', retentionSweeper);
    logger.info(result, 'retention: cron run complete');
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, 'retention: cron run failed');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
