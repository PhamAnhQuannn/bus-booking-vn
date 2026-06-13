/**
 * GET /api/cron/generate-ticket-pdfs
 *
 * Invoked on a short interval by Vercel Cron (see vercel.json).
 * Secures via CRON_SECRET header check (Vercel injects this automatically).
 *
 * Sweeps PAID bookings with no ticket PDF yet (`ticketPdfKey IS NULL`), renders
 * the ticket PDF (with QR) in-process, uploads it via lib/storage.putObject (NO
 * self-fetch), stamps the key, and enqueues a 'ticketReady' email NotificationLog
 * for the dispatcher (Issue 074).
 *
 * Runs under the advisory-lock + JobRunLog wrapper (lib/jobs/runJob +
 * withAdvisoryLock) with a NEW lock key 'ticket-pdf' (no collision with
 * hold-expiry / notify-dispatch / payout-processor / trip-complete / sales-close
 * / trip-generate). A concurrent tick that finds the lock held returns
 * { status: 'skipped_locked', rowsAffected: 0 }. The claim query's FOR UPDATE
 * SKIP LOCKED + the `ticketPdfKey IS NULL` stamp guard are belt-and-suspenders so
 * each booking is rendered exactly once even under a manual-trigger race.
 *
 * Returns: { rowsAffected, status } on success, 401 on auth failure, 500 on error.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { runJob } from '@/lib/jobs';
import { generateTicketPdfs } from '@/lib/jobs';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  // Authenticate via CRON_SECRET (Vercel sets Authorization: Bearer <secret>)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const result = await runJob('ticket-pdf', generateTicketPdfs);
    logger.info(result, 'generate-ticket-pdfs: cron run complete');
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, 'generate-ticket-pdfs: cron run failed');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
