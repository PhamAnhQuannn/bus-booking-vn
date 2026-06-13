/**
 * GET /api/cron/reconcile-payments
 *
 * Invoked every 15 min by Vercel Cron (see vercel.json). Secures via CRON_SECRET
 * header (Vercel injects `Authorization: Bearer <secret>`).
 *
 * Resolves stuck `awaiting_payment` bookings the webhook left behind (Issue 095):
 *   - a confirming PaymentEvent (paid, amount >= total, VND) → paid (shared
 *     guarded monotonic transition + ledger, same as processWebhook);
 *   - no confirmation AND the hold has expired → payment_failed_expired;
 *   - underpaid / wrong-currency success rows parked by issue 032 → expired, never
 *     accepted as paid;
 *   - degraded bank-transfer match (amount + receiving account + time-window).
 *
 * Runs under the advisory-lock + JobRunLog wrapper (Issue 019/043 machinery) with
 * the unique lock key 'reconcile-payments', so two overlapping ticks cannot race —
 * a concurrent tick that finds the lock held returns { status: 'skipped_locked',
 * rowsAffected: 0 }. Per-candidate SELECT … FOR NO KEY UPDATE SKIP LOCKED + the
 * map-derived monotonic guard prevent double-processing and any paid regression.
 *
 * Returns: { rowsAffected, status } on success, 401 on auth failure, 500 on error.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { runJob } from '@/lib/jobs';
import { reconcilePayments } from '@/lib/jobs';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  // Authenticate via CRON_SECRET (Vercel sets Authorization: Bearer <secret>)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const result = await runJob('reconcile-payments', reconcilePayments);
    logger.info(result, 'reconcile-payments: cron run complete');
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, 'reconcile-payments: cron run failed');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
