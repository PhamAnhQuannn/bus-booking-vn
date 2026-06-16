/**
 * VNPay payment gateway adapter.
 *
 * Implements PaymentGateway for VNPay domestic card + ATM transfers.
 *
 * Signature algorithm (VNPay public docs):
 *   HMAC-SHA512 over alphabetically-sorted query string of all vnp_* fields
 *   (excluding vnp_SecureHash itself), joined with "&".
 *
 * Security notes:
 *   - Uses crypto.timingSafeEqual for constant-time comparison.
 *   - Length guard prevents throw when hashes differ in length.
 *   - NEVER logs hashSecret or raw webhook body.
 */

import crypto from 'crypto';
import { getEnv } from '@/lib/config';
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
  returnUrl: string;
}

const VNPAY_SUCCESS_CODE = '00';
const VNPAY_FAILURE_CODES = new Set(['24', '51', '65', '75', '11', '12', '13']);
const VNPAY_PENDING_CODES = new Set(['01', '02']);

function classifyVnpayStatus(responseCode: string): CanonicalPaymentStatus {
  if (responseCode === VNPAY_SUCCESS_CODE) return 'paid';
  if (VNPAY_FAILURE_CODES.has(responseCode)) return 'failed';
  if (VNPAY_PENDING_CODES.has(responseCode)) return 'pending';
  return 'unknown';
}

function sortedQueryString(params: Record<string, string>): string {
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

  const verifyWebhook = (rawBody: string): VerifyWebhookResult => {
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(rawBody) as Record<string, string>;
    } catch {
      return { ok: false, reason: 'invalid_json' };
    }

    const receivedHash = parsed.vnp_SecureHash;
    if (typeof receivedHash !== 'string' || receivedHash.length === 0) {
      return { ok: false, reason: 'missing_signature' };
    }

    const verifyParams: Record<string, string> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType') {
        verifyParams[key] = val;
      }
    }

    const signData = sortedQueryString(verifyParams);
    const expected = hmacSha512(hashSecret, signData);

    if (!timingSafeHexEqual(expected, receivedHash)) {
      return { ok: false, reason: 'sig_mismatch' };
    }

    const orderRef = String(parsed.vnp_TxnRef ?? '');
    const providerTxnId = String(parsed.vnp_TransactionNo ?? '');
    const responseCode = String(parsed.vnp_ResponseCode ?? '99');
    const amount = Math.floor(Number(parsed.vnp_Amount ?? 0) / 100);
    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false, reason: 'invalid_amount' };
    }

    return {
      ok: true,
      event: {
        orderRef,
        providerTxnId,
        amount,
        currency: 'VND',
        status: classifyVnpayStatus(responseCode),
      },
    };
  };

  const createPayment = async (
    input: CreatePaymentInput,
  ): Promise<CreatePaymentResult> => {
    const { orderId, amount, orderInfo, redirectUrl: inputRedirectUrl, requestId } = input;
    void requestId;

    const now = new Date();
    const createDate = now
      .toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 14);

    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(amount * 100),
      vnp_CreateDate: createDate,
      vnp_CurrCode: 'VND',
      vnp_IpAddr: '127.0.0.1',
      vnp_Locale: 'vn',
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: inputRedirectUrl || returnUrl,
      vnp_TxnRef: orderId,
    };

    const signData = sortedQueryString(params);
    const secureHash = hmacSha512(hashSecret, signData);

    const payUrl = `${vnpUrl}?${signData}&vnp_SecureHash=${secureHash}`;

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
    returnUrl: env.VNPAY_RETURN_URL,
  });

  return _vnpayAdapter;
}

export function _resetVnpayAdapter(): void {
  _vnpayAdapter = null;
}
