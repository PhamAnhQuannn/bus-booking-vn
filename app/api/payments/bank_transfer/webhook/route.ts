/**
 * POST /api/payments/bank_transfer/webhook — SePay IPN receiver.
 *
 * Auth: API key (SEPAY_API_KEY) in the Authorization header. SePay does not use
 * HMAC body signing — the key IS the authentication. SePay's "API Key" auth type
 * sends `Authorization: Apikey <key>`; we also accept `Bearer <key>` so the
 * endpoint keeps working if the webhook is reconfigured. Verified here before
 * calling processPaymentWebhook.
 *
 * SePay payload: JSON with `content` field containing the transfer memo. The
 * adapter extracts the bookingRef from the memo using BOOKING_REF_REGEX.
 *
 * Ack contract: SePay only counts a delivery as successful on HTTP 200/201 with
 * a JSON body of exactly `{"success": true}` within 30s. Anything else triggers
 * Fibonacci-spaced retries (max 7 attempts over 5 hours). processPaymentWebhook
 * is shared across adapters and returns `{message:'ok'}`, so we re-emit the
 * SePay-shaped ack here for 2xx and pass non-2xx through untouched (those SHOULD
 * be retried).
 *
 * When the memo contains no recognisable bookingRef, the adapter returns
 * { ok: false, reason: 'no_booking_ref_in_memo', unmatched: { providerTxnId } }.
 * We ack 200 (not 400) so SePay doesn't retry — the transfer is real, we just
 * can't match it — and record it as an ORPHAN PaymentEvent (Bug B) so the
 * reconciliation sweeper can degrade-match it by amount + adapter + time window.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import {
  getBankTransferAdapter,
  processPaymentWebhook,
  recordUnmatchedPaymentEvent,
  UNMATCHED_REASON,
} from '@/lib/payment';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { logger } from '@/lib/logger';
import { captureException } from '@/lib/observability';
import { clientIp } from '@/lib/core/http/clientIp';
import { getEnv } from '@/lib/config';
import crypto from 'crypto';

/** SePay's required success ack — 200 with exactly `{"success": true}`. */
function sepayAck(): Response {
  return NextResponse.json({ success: true }, { status: 200 });
}

// SePay sends `Apikey <key>`; `Bearer <key>` accepted as an alternate config.
const AUTH_SCHEME_REGEX = /^(?:Apikey|Bearer)\s+(.+)$/i;

async function handler(req: NextRequest): Promise<Response> {
  const env = getEnv();
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';

  const authHeader = req.headers.get('authorization') ?? '';
  const token = AUTH_SCHEME_REGEX.exec(authHeader)?.[1] ?? '';

  if (!env.SEPAY_API_KEY || !token) {
    logger.warn({ adapter: 'bank_transfer' }, 'payment.bank_transfer.webhook.missing_auth');
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const expected = Buffer.from(env.SEPAY_API_KEY, 'utf8');
  const received = Buffer.from(token, 'utf8');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    // error + captureException, not warn. A static API key is the ENTIRE perimeter
    // here — SePay offers no body signature to fall back on (see the header note),
    // so a leaked key means unlimited forged 'paid' events. SePay itself only ever
    // presents the correct key, so a well-formed request bearing a WRONG one is
    // never routine: it is a misconfiguration or someone probing. That deserves to
    // page rather than settle into the warn stream. Deliberately paired with the
    // key-rotation runbook (documentation/runbooks/sepay-api-key-rotation.md) —
    // an alert nobody has a response for is not a control.
    //
    // Never log the presented token: a near-miss would leak key material, and a
    // hit-by-length probe would confirm the key's length.
    logger.error(
      { adapter: 'bank_transfer', ip: clientIp(req.headers) },
      'payment.bank_transfer.webhook.invalid_bearer — wrong API key presented; investigate for key leak',
    );
    captureException(new Error('SePay webhook: invalid API key presented'), {
      adapter: 'bank_transfer',
      area: 'payment.webhook.auth',
    });
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const rawBody = await req.text();
  const gateway = getBankTransferAdapter();

  const preVerify = gateway.verifyWebhook(rawBody, { expectedAccount: env.VIETQR_ACCOUNT_NUMBER });

  // Issue 334: transfer landed in an account that is NOT our configured VietQR
  // receiving account. Not our money — never credit. Record it as an orphan (money
  // arrived somewhere) + warn loudly so a genuine account-format mismatch is visible,
  // then ack 200 so SePay stops retrying. The reconcile suspicion-hold never
  // auto-credits an orphan, so a foreign account stays held for manual review.
  if (!preVerify.ok && preVerify.reason === UNMATCHED_REASON.ACCOUNT_MISMATCH) {
    if (preVerify.unmatched) {
      await recordUnmatchedPaymentEvent({
        adapter: 'bank_transfer',
        providerTxnId: preVerify.unmatched.providerTxnId,
        rawBody,
        unmatchedReason: UNMATCHED_REASON.ACCOUNT_MISMATCH,
      });
    }
    logger.warn(
      { adapter: 'bank_transfer', reason: preVerify.reason },
      'payment.bank_transfer.webhook.account_mismatch — held, not credited',
    );
    return sepayAck();
  }

  if (!preVerify.ok && preVerify.reason === UNMATCHED_REASON.NO_BOOKING_REF) {
    // Bug B: this short-circuit never reaches processPaymentWebhook, so the orphan
    // row has to be written here. It is also the COMMON unmatched case — the memo
    // the customer never typed, or one the bank mangled past EXTRACT_REGEX. Without
    // it the transfer leaves zero DB trace and the reconcile sweeper (which the
    // header comment promises handles these) has nothing to degrade-match.
    if (preVerify.unmatched) {
      await recordUnmatchedPaymentEvent({
        adapter: 'bank_transfer',
        providerTxnId: preVerify.unmatched.providerTxnId,
        rawBody,
        unmatchedReason: UNMATCHED_REASON.NO_BOOKING_REF,
      });
    }
    logger.info(
      { adapter: 'bank_transfer', reason: preVerify.reason },
      'payment.bank_transfer.webhook.unmatched — 200 no-op',
    );
    return sepayAck();
  }

  const res = await processPaymentWebhook({
    rawBody,
    gateway,
    adapter: 'bank_transfer',
    proto,
    host,
  });

  // Re-emit 2xx in SePay's ack shape; let non-2xx through so SePay retries.
  return res.status >= 200 && res.status < 300 ? sepayAck() : res;
}

export const POST = withErrorHandler(handler);
