/**
 * GET /api/cron/process-refunds (#569 — SEC-REFUND-DURABILITY)
 *
 * Invoked every 5 min by Vercel Cron (vercel.json). Secures via CRON_SECRET
 * (Vercel injects `Authorization: Bearer <secret>`) through the shared assertCronAuth.
 *
 * Drives durable RefundObligation rows to completion via refundOut with retry + backoff —
 * the single execution path for overpay/oversold refund-outs (enqueued in the paid tx by
 * processWebhook). Runs under the advisory-lock + JobRunLog wrapper with the unique lock key
 * 'process-refunds'; a concurrent tick that finds the lock held returns skipped_locked.
 *
 * Returns { rowsAffected, status } on success, 401 on auth failure, 500 on error.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/core/http/cronAuth';
import { runJob } from '@/lib/jobs';
import { processRefunds } from '@/lib/jobs';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await runJob('process-refunds', processRefunds);
    logger.info(result, 'process-refunds: cron run complete');
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, 'process-refunds: cron run failed');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
