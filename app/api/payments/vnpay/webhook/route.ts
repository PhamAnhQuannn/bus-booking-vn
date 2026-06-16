/**
 * GET + POST /api/payments/vnpay/webhook — VNPay IPN receiver.
 *
 * VNPay sends IPN as either:
 *   - POST with URL-encoded form body (newer integration guide), or
 *   - GET with vnp_* params in the query string (older / some sandbox configs).
 *
 * Both paths normalise to a URL-encoded string, verify the HMAC signature, then
 * delegate processing to processPaymentWebhook (DB transitions, notifications).
 *
 * VNPay API v2.1.0 requires IPN responses in its own format:
 *   { RspCode: '00', Message: 'Confirm Success' }   — signature valid + processed
 *   { RspCode: '97', Message: 'Invalid Checksum' }  — signature mismatch
 *   { RspCode: '01', Message: 'Order not found' }   — booking ref unknown
 *   { RspCode: '99', Message: 'Unknown error' }     — processing error
 *
 * Returning any other format causes VNPay to retry the IPN indefinitely.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { getVnpayAdapter, processPaymentWebhook } from '@/lib/payment';
import { prisma } from '@/lib/core/db/client';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { logger } from '@/lib/logger';

// VNPay v2.1.0 IPN response codes
const VNPAY_IPN = {
  SUCCESS: { RspCode: '00', Message: 'Confirm Success' },
  INVALID_CHECKSUM: { RspCode: '97', Message: 'Invalid Checksum' },
  ORDER_NOT_FOUND: { RspCode: '01', Message: 'Order not found' },
  UNKNOWN_ERROR: { RspCode: '99', Message: 'Unknown error' },
} as const;

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

  // Verify HMAC signature BEFORE any processing. Return RspCode 97 immediately
  // on failure so VNPay knows to stop retrying (a retried bad-sig IPN is always bad).
  const verifyResult = getVnpayAdapter().verifyWebhook(rawBody);
  if (!verifyResult.ok) {
    logger.warn(
      { adapter: 'vnpay', reason: verifyResult.reason },
      'payment.vnpay.webhook.sig_invalid',
    );
    return NextResponse.json(VNPAY_IPN.INVALID_CHECKSUM);
  }

  // VNPay v2.1.0: return ORDER_NOT_FOUND for unknown booking refs so VNPay
  // stops retrying instead of looping on a generic '00' success.
  const bookingRef = verifyResult.event.orderRef;
  const bookingExists = await prisma.booking.findUnique({
    where: { bookingRef },
    select: { id: true },
  });
  if (!bookingExists) {
    logger.info({ adapter: 'vnpay', bookingRef }, 'payment.vnpay.webhook.order_not_found');
    return NextResponse.json(VNPAY_IPN.ORDER_NOT_FOUND);
  }

  // Signature valid + booking exists — run the full processing pipeline.
  // processPaymentWebhook re-verifies internally (idempotent); we ignore its Response
  // body and always return the VNPay-required format.
  try {
    await processPaymentWebhook({
      rawBody,
      gateway: getVnpayAdapter(),
      adapter: 'vnpay',
      proto,
      host,
    });
  } catch (err: unknown) {
    logger.error({ err, adapter: 'vnpay' }, 'payment.vnpay.webhook.processing_error');
    return NextResponse.json(VNPAY_IPN.UNKNOWN_ERROR);
  }

  return NextResponse.json(VNPAY_IPN.SUCCESS);
}

export const GET = withErrorHandler(handler);
export const POST = withErrorHandler(handler);
