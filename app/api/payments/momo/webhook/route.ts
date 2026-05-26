/**
 * POST /api/payments/momo/webhook — MoMo IPN receiver.
 *
 * Thin gateway-specific shell: reads the raw body + request headers, then
 * delegates to the shared processPaymentWebhook with MoMo's gateway adapter
 * and MoMo-spec resultCode sets. All security/idempotency/SMS logic lives in
 * lib/payment/processWebhook.ts (shared across momo | zalopay | card).
 *
 * resultCode sets are sourced from the Issue 004 acceptance spec VERBATIM —
 * never augmented from upstream MoMo docs (see AGENTS.md mistake log 2026-05-18).
 */

export const runtime = 'nodejs';

import { type NextRequest } from 'next/server';
import { getMomoAdapter } from '@/lib/payment/momo';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { processPaymentWebhook } from '@/lib/payment/processWebhook';

/** MoMo resultCodes that mean payment definitively failed (per Issue 004 spec). */
const FAILURE_RESULT_CODES = new Set([1001, 1002, 1003, 1004, 1005, 4100]);

/** MoMo resultCodes that indicate pending / processing (no status transition yet). */
const PENDING_RESULT_CODES = new Set([9000, 1000]);

async function handler(req: NextRequest): Promise<Response> {
  const rawBody = await req.text();
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';

  return processPaymentWebhook({
    rawBody,
    gateway: getMomoAdapter(),
    adapter: 'momo',
    proto,
    host,
    failureResultCodes: FAILURE_RESULT_CODES,
    pendingResultCodes: PENDING_RESULT_CODES,
  });
}

export const POST = withErrorHandler(handler);
