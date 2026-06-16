/**
 * VNPay payment gateway adapter.
 *
 * Implements PaymentGateway for VNPay domestic card + ATM transfers.
 *
 * Signature algorithm (VNPay public docs):
 *   HMAC-SHA512 over alphabetically-sorted canonical string of all vnp_* fields
 *   (excluding vnp_SecureHash and vnp_SecureHashType), joined with "&".
 *   Values are RAW (not URL-encoded) in the sign data string.
 *   Values ARE URL-encoded in the payment URL query string.
 *
 * Security notes:
 *   - Uses crypto.timingSafeEqual for constant-time comparison.
 *   - Length guard prevents throw when hashes differ in length.
 *   - NEVER logs hashSecret or raw webhook body.
 */

import crypto from 'crypto';
import { getEnv } from '@/lib/config';
import { logger } from '@/lib/logger';
import type {
  PaymentGateway,
  CreatePaymentInput,
  CreatePaymentResult,
  VerifyWebhookResult,
  CanonicalPaymentStatus,
} from '../gateway';

export interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  vnpUrl: string;
  /** Fallback return URL used when createPayment's redirectUrl is not provided. */
  returnUrl?: string;
}

const VNPAY_SUCCESS_CODE = '00';
const VNPAY_FAILURE_CODES = new Set(['24', '51', '65', '75', '11', '12', '13']);
const VNPAY_PENDING_CODES = new Set(['01', '02']);

function classifyVnpayStatus(code: string): CanonicalPaymentStatus {
  if (code === VNPAY_SUCCESS_CODE) return 'paid';
  if (VNPAY_FAILURE_CODES.has(code)) return 'failed';
  if (VNPAY_PENDING_CODES.has(code)) return 'pending';
  return 'unknown';
}

/**
 * Build the HMAC canonical string: sorted keys, RAW (not URL-encoded) values,
 * joined with "&". This is what VNPay signs/verifies.
 */
function buildSignData(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
}

/**
 * Build URL query string: sorted keys, URL-encoded values, joined with "&".
 * Used to construct the payment URL appended after "?".
 */
function buildQueryString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join('&');
}

function hmacSha512(secret: string, data: string): string {
  return crypto.createHmac('sha512', secret).update(data).digest('hex');
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function createVnpayAdapter(
  config: VnpayConfig,
  fetchFn: typeof fetch = fetch,
): PaymentGateway {
  void fetchFn;
  const { tmnCode, hashSecret, vnpUrl, returnUrl } = config;

  /**
   * verifyWebhook — accepts a URL-encoded string (IPN POST body or
   * reconstructed GET query string) or a pre-parsed Record<string,string>.
   *
   * VNPay IPN comes as URL-encoded form data (POST) or query params (GET),
   * NOT JSON.
   */
  const verifyWebhook = (rawBody: string): VerifyWebhookResult => {
    // Parse as URLSearchParams (handles both POST body and GET query string)
    const parsed: Record<string, string> = {};
    const params = new URLSearchParams(rawBody);
    for (const [key, value] of params.entries()) {
      parsed[key] = value;
    }

    const receivedHash = parsed['vnp_SecureHash'];
    if (typeof receivedHash !== 'string' || receivedHash.length === 0) {
      logger.warn({ reason: 'missing_signature' }, 'payment.vnpay.verify_failed');
      return { ok: false, reason: 'missing_signature' };
    }

    const verifyParams: Record<string, string> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType') {
        verifyParams[key] = val;
      }
    }

    // Sign data uses RAW values (not URL-encoded)
    const signData = buildSignData(verifyParams);
    const expected = hmacSha512(hashSecret, signData);

    if (!timingSafeHexEqual(expected, receivedHash)) {
      const bookingRef = parsed['vnp_TxnRef'] ?? '';
      const responseCode = parsed['vnp_ResponseCode'] ?? '';
      logger.warn(
        { reason: 'sig_mismatch', bookingRef, responseCode },
        'payment.vnpay.verify_failed',
      );
      return { ok: false, reason: 'sig_mismatch' };
    }

    const orderRef = String(parsed['vnp_TxnRef'] ?? '');
    const providerTxnId = String(parsed['vnp_TransactionNo'] ?? '');
    const responseCode = String(parsed['vnp_ResponseCode'] ?? '99');
    // vnp_TransactionStatus is the IPN-authoritative field; fall back to
    // vnp_ResponseCode if absent (return-URL flow omits it).
    const transactionStatus = parsed['vnp_TransactionStatus'];
    const classifyCode = transactionStatus !== undefined ? transactionStatus : responseCode;
    const amount = Math.floor(Number(parsed['vnp_Amount'] ?? 0) / 100);
    if (!Number.isFinite(amount) || amount < 0) {
      logger.warn(
        { reason: 'invalid_amount', bookingRef: orderRef, responseCode },
        'payment.vnpay.verify_failed',
      );
      return { ok: false, reason: 'invalid_amount' };
    }

    logger.info(
      { bookingRef: orderRef, amount, responseCode, transactionStatus },
      'payment.vnpay.verified',
    );

    return {
      ok: true,
      event: {
        orderRef,
        providerTxnId,
        amount,
        currency: 'VND',
        status: classifyVnpayStatus(classifyCode),
      },
    };
  };

  const createPayment = async (
    input: CreatePaymentInput,
  ): Promise<CreatePaymentResult> => {
    const {
      orderId,
      amount,
      orderInfo,
      redirectUrl: inputRedirectUrl,
      ipnUrl: inputIpnUrl,
      requestId,
      clientIp,
    } = input;
    void requestId;

    // VNPay createDate must be in Vietnam time (UTC+7)
    const now = new Date(Date.now() + 7 * 3600_000);
    const createDate = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);

    // Determine the return URL — must be absolute for VNPay.
    // initiateOnlineBooking always provides redirectUrl; returnUrl is a fallback.
    const resolvedReturnUrl = inputRedirectUrl || returnUrl || '';
    if (!resolvedReturnUrl.startsWith('http')) {
      logger.warn(
        { returnUrl: resolvedReturnUrl },
        'payment.vnpay.relative_return_url — VNPay requires an absolute URL; using as-is',
      );
    }

    // vnp_IpnUrl is REQUIRED by VNPay v2.1.0. Use the caller-provided ipnUrl
    // (set by initiateOnlineBooking as `${baseUrl}/api/payments/vnpay/webhook`).
    // Fall back to VNPAY_IPN_URL env var as a safety net for misconfigured callers.
    const resolvedIpnUrl = inputIpnUrl || (getEnv().VNPAY_IPN_URL ?? '');
    if (!resolvedIpnUrl) {
      throw new Error('vnpay: ipnUrl is required — provide it in createPayment input or set VNPAY_IPN_URL');
    }

    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(amount * 100),
      vnp_CreateDate: createDate,
      vnp_CurrCode: 'VND',
      vnp_IpAddr: clientIp ?? '127.0.0.1',
      vnp_IpnUrl: resolvedIpnUrl,
      vnp_Locale: 'vn',
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: resolvedReturnUrl,
      vnp_TxnRef: orderId,
    };

    // Sign data uses RAW values; query string uses URL-encoded values
    const signData = buildSignData(params);
    const secureHash = hmacSha512(hashSecret, signData);

    const queryString = buildQueryString(params);
    const payUrl = `${vnpUrl}?${queryString}&vnp_SecureHash=${secureHash}`;

    logger.info({ orderId, amount }, 'payment.vnpay.url_built');

    return {
      ok: true,
      payUrl,
      externalRef: orderId,
    };
  };

  return { createPayment, verifyWebhook };
}

let _vnpayAdapter: PaymentGateway | null = null;

export function getVnpayAdapter(): PaymentGateway {
  if (_vnpayAdapter) return _vnpayAdapter;

  const env = getEnv();

  _vnpayAdapter = createVnpayAdapter({
    tmnCode: env.VNPAY_TMN_CODE,
    hashSecret: env.VNPAY_HASH_SECRET,
    vnpUrl: env.VNPAY_URL,
    returnUrl: env.VNPAY_RETURN_URL,  // optional — initiateOnlineBooking always passes redirectUrl
  });

  return _vnpayAdapter;
}

export function _resetVnpayAdapter(): void {
  _vnpayAdapter = null;
}
