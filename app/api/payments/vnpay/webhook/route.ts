/**
 * GET + POST /api/payments/vnpay/webhook — VNPay IPN receiver.
 *
 * VNPay sends IPN as either:
 *   - POST with URL-encoded form body (newer integration guide), or
 *   - GET with vnp_* params in the query string (older / some sandbox configs).
 *
 * Both paths normalise to a URL-encoded string and delegate to
 * processPaymentWebhook → getVnpayAdapter().verifyWebhook().
 * All security/idempotency/SMS logic lives in lib/payment/processWebhook.ts.
 */

export const runtime = 'nodejs';

import { type NextRequest } from 'next/server';
import { getVnpayAdapter, processPaymentWebhook } from '@/lib/payment';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { logger } from '@/lib/logger';

async function handler(req: NextRequest): Promise<Response> {
  logger.info({ adapter: 'vnpay', method: req.method }, 'payment.vnpay.webhook_received');

  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';

  let rawBody: string;

  if (req.method === 'GET') {
    // VNPay GET IPN: all vnp_* params are in the URL query string.
    // Reconstruct a URL-encoded string so verifyWebhook can parse it identically
    // to a POST body (both are URLSearchParams-compatible).
    const parts: string[] = [];
    req.nextUrl.searchParams.forEach((value, key) => {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    });
    rawBody = parts.join('&');
  } else {
    // POST: read body text directly (URL-encoded form or raw query string)
    rawBody = await req.text();
  }

  return processPaymentWebhook({
    rawBody,
    gateway: getVnpayAdapter(),
    adapter: 'vnpay',
    proto,
    host,
  });
}

export const GET = withErrorHandler(handler);
export const POST = withErrorHandler(handler);
