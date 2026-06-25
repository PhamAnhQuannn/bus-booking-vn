/**
 * POST /api/payments/bank_transfer/webhook — SePay IPN receiver.
 *
 * Auth: Bearer token (SEPAY_API_KEY) in the Authorization header. SePay does
 * not use HMAC body signing — the bearer token IS the authentication. Verified
 * here before calling processPaymentWebhook.
 *
 * SePay payload: JSON with `content` field containing the transfer memo. The
 * adapter extracts the bookingRef from the memo using BOOKING_REF_REGEX.
 *
 * When the memo contains no recognisable bookingRef, the adapter returns
 * { ok: false, reason: 'no_booking_ref_in_memo' }. We return 200 (not 400) so
 * SePay doesn't retry — the transfer is real, we just can't match it. The
 * reconciliation sweeper handles unmatched transfers.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { getBankTransferAdapter, processPaymentWebhook } from '@/lib/payment';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { logger } from '@/lib/logger';
import { getEnv } from '@/lib/config';
import crypto from 'crypto';

async function handler(req: NextRequest): Promise<Response> {
  const env = getEnv();
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!env.SEPAY_API_KEY || !token) {
    logger.warn({ adapter: 'bank_transfer' }, 'payment.bank_transfer.webhook.missing_auth');
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const expected = Buffer.from(env.SEPAY_API_KEY, 'utf8');
  const received = Buffer.from(token, 'utf8');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    logger.warn({ adapter: 'bank_transfer' }, 'payment.bank_transfer.webhook.invalid_bearer');
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const rawBody = await req.text();
  const gateway = getBankTransferAdapter();

  const preVerify = gateway.verifyWebhook(rawBody);
  if (!preVerify.ok && preVerify.reason === 'no_booking_ref_in_memo') {
    logger.info(
      { adapter: 'bank_transfer', reason: preVerify.reason },
      'payment.bank_transfer.webhook.unmatched — 200 no-op',
    );
    return NextResponse.json({ message: 'ok' }, { status: 200 });
  }

  return processPaymentWebhook({
    rawBody,
    gateway,
    adapter: 'bank_transfer',
    proto,
    host,
  });
}

export const POST = withErrorHandler(handler);
