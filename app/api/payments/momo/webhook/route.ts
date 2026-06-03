/**
 * POST /api/payments/momo/webhook — MoMo IPN receiver.
 *
 * Thin gateway-specific shell: reads the raw body + request headers, then
 * delegates to the shared processPaymentWebhook with MoMo's gateway adapter.
 * All security/idempotency/SMS logic lives in lib/payment/processWebhook.ts
 * (shared across momo | zalopay | card).
 *
 * resultCode → canonical-status mapping now lives in the MoMo adapter
 * (lib/payment/momo.ts), sourced from the Issue 004 acceptance spec VERBATIM —
 * never augmented from upstream MoMo docs (see AGENTS.md mistake log 2026-05-18).
 */

export const runtime = 'nodejs';

import { type NextRequest } from 'next/server';
import { getMomoAdapter } from '@/lib/payment/adapters/momo';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { processPaymentWebhook } from '@/lib/payment/processWebhook';

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
  });
}

export const POST = withErrorHandler(handler);
