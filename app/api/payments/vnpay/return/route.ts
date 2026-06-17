/**
 * GET /api/payments/vnpay/return — VNPay browser return URL.
 *
 * After payment, VNPay redirects the user's browser here with vnp_* query params
 * including a vnp_SecureHash signature. We verify the signature before acting on
 * the result. Only redirect to the confirmation page if signature is valid AND
 * vnp_ResponseCode === '00' (success). All other outcomes redirect to an
 * error/pending page so the buyer sees appropriate messaging.
 *
 * NOTE: The definitive booking state transition happens via the IPN webhook
 * (/api/payments/vnpay/webhook), NOT here. This route is browser-UX only.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { getVnpayAdapter } from '@/lib/payment';
import { logger } from '@/lib/logger';

export function GET(req: NextRequest): NextResponse {
  const txnRef = req.nextUrl.searchParams.get('vnp_TxnRef') ?? '';
  const responseCode = req.nextUrl.searchParams.get('vnp_ResponseCode') ?? '';

  logger.info({ txnRef, responseCode }, 'payment.vnpay.return');

  // Reconstruct URL-encoded string from all query params for signature verification
  const parts: string[] = [];
  req.nextUrl.searchParams.forEach((value, key) => {
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  });
  const rawQueryString = parts.join('&');

  // Verify HMAC signature — reject tampered return URLs
  const verifyResult = getVnpayAdapter().verifyWebhook(rawQueryString);
  if (!verifyResult.ok) {
    logger.warn(
      { txnRef, responseCode, reason: verifyResult.reason },
      'payment.vnpay.return.sig_invalid — redirecting to error page',
    );
    return NextResponse.redirect(
      new URL(
        `/booking/payment-error?ref=${encodeURIComponent(txnRef)}&reason=sig_invalid`,
        req.url,
      ),
    );
  }

  // Guard: a zero-amount return is invalid — treat as a tampered/synthetic callback.
  // The IPN is the authoritative payment record; this is browser-UX only, but we
  // must not redirect to confirmation for a zero-amount result (e.g. a crafted URL
  // with responseCode=00 but vnp_Amount=0).
  if (verifyResult.event.amount === 0) {
    logger.warn(
      { txnRef, responseCode, amount: 0 },
      'payment.vnpay.return.zero_amount — redirecting to error page',
    );
    return NextResponse.redirect(
      new URL(
        `/booking/payment-error?ref=${encodeURIComponent(txnRef)}&reason=invalid_amount`,
        req.url,
      ),
    );
  }

  // Signature valid — check the response code
  if (responseCode !== '00') {
    logger.info(
      { txnRef, responseCode },
      'payment.vnpay.return.non_success — redirecting to pending/error page',
    );
    return NextResponse.redirect(
      new URL(
        `/booking/payment-pending?ref=${encodeURIComponent(txnRef)}&code=${encodeURIComponent(responseCode)}`,
        req.url,
      ),
    );
  }

  // Success: signature valid + response code 00
  return NextResponse.redirect(
    new URL(`/booking/confirmation?ref=${encodeURIComponent(txnRef)}`, req.url),
  );
}
