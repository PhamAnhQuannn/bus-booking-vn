/**
 * POST /api/payments/vnpay/webhook — VNPay IPN receiver.
 *
 * Thin gateway-specific shell: reads the raw body + request headers, then
 * delegates to the shared processPaymentWebhook with VNPay's gateway adapter.
 * All security/idempotency/SMS logic lives in lib/payment/processWebhook.ts.
 */

export const runtime = 'nodejs';

import { type NextRequest } from 'next/server';
import { getVnpayAdapter, processPaymentWebhook } from '@/lib/payment';
import { withErrorHandler } from '@/lib/withErrorHandler';

async function handler(req: NextRequest): Promise<Response> {
  const rawBody = await req.text();
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';

  return processPaymentWebhook({
    rawBody,
    gateway: getVnpayAdapter(),
    adapter: 'vnpay',
    proto,
    host,
  });
}

export const POST = withErrorHandler(handler);
