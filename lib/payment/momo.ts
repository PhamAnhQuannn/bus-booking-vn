/**
 * MoMo payment gateway adapter.
 *
 * Implements PaymentGateway for the MoMo e-wallet provider.
 *
 * Signature algorithm (vendor-public, from MoMo IPN docs):
 *   HMAC-SHA256 over alphabetically-sorted canonical string of ALL OTHER
 *   fields (i.e., all fields except "signature" itself), joined with "&":
 *
 *     accessKey=$v&amount=$v&extraData=$v&message=$v&orderId=$v
 *     &orderInfo=$v&orderType=$v&partnerCode=$v&payType=$v
 *     &requestId=$v&responseTime=$v&resultCode=$v&transId=$v
 *
 * For createPayment request, the same alphabetical sort applies to all
 * request fields except "signature".
 *
 * Security notes:
 *   - Uses crypto.timingSafeEqual for constant-time comparison.
 *   - Length guard prevents throw when signatures have different lengths.
 *   - NEVER logs secretKey or raw webhook body.
 */

import crypto from 'crypto';
import { getEnv } from '@/lib/config/env';
import type {
  PaymentGateway,
  CreatePaymentInput,
  CreatePaymentResult,
  VerifyWebhookResult,
  CanonicalPaymentStatus,
} from './gateway';

export interface MomoConfig {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  endpoint: string;
}

/**
 * MoMo resultCode → canonical status classifier. Sets relocated from the
 * webhook route VERBATIM (Issue 004 acceptance spec — never augmented from
 * upstream MoMo docs; see AGENTS.md mistake log 2026-05-18). Native MoMo
 * resultCodes stay internal to this file; only the canonical status escapes.
 */
const MOMO_FAILURE_RESULT_CODES = new Set([1001, 1002, 1003, 1004, 1005, 4100]);
const MOMO_PENDING_RESULT_CODES = new Set([9000, 1000]);
function classifyMomoStatus(resultCode: number): CanonicalPaymentStatus {
  if (resultCode === 0) return 'paid';
  if (MOMO_FAILURE_RESULT_CODES.has(resultCode)) return 'failed';
  if (MOMO_PENDING_RESULT_CODES.has(resultCode)) return 'pending';
  return 'unknown';
}

/**
 * Build the canonical sort string used for HMAC-SHA256 signing.
 * Sorts object keys alphabetically, excludes 'signature' field,
 * joins as key=value pairs with '&'.
 */
function buildCanonicalString(obj: Record<string, unknown>): string {
  return Object.keys(obj)
    .filter((k) => k !== 'signature')
    .sort()
    .map((k) => `${k}=${obj[k]}`)
    .join('&');
}

/**
 * Compute HMAC-SHA256 hex digest of the canonical string.
 */
function hmacSha256(secretKey: string, data: string): string {
  return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
}

/**
 * Constant-time comparison of two hex strings.
 * Returns false (not throw) when lengths differ.
 */
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

/**
 * Create a MoMo adapter. Accepts an optional `fetchFn` for dependency
 * injection in tests (avoids real HTTP calls).
 */
export function createMomoAdapter(
  config: MomoConfig,
  fetchFn: typeof fetch = fetch
): PaymentGateway {
  const { partnerCode, accessKey, secretKey, endpoint } = config;

  const verifyWebhook = (rawBody: string): VerifyWebhookResult => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return { ok: false, reason: 'invalid_json' };
    }

    const receivedSig = parsed.signature;
    if (typeof receivedSig !== 'string' || receivedSig.length === 0) {
      return { ok: false, reason: 'missing_signature' };
    }

    const canonical = buildCanonicalString(parsed);
    const expected = hmacSha256(secretKey, canonical);

    if (!timingSafeHexEqual(expected, receivedSig)) {
      return { ok: false, reason: 'sig_mismatch' };
    }

    // Parse the raw IPN fields needed for the canonical event. The native
    // resultCode stays internal to this file (mapped to status below);
    // message/partnerCode/requestId/orderInfo/orderType/payType/responseTime/
    // extraData are not consumed downstream and are intentionally dropped.
    const orderRef = String(parsed.orderId ?? '');
    const providerTxnId = String(parsed.transId ?? '');
    const resultCode = Number(parsed.resultCode ?? -1);
    const amount = Number(parsed.amount ?? 0);

    // MoMo IPN carries no currency field — VND by construction.
    return {
      ok: true,
      event: {
        orderRef,
        providerTxnId,
        amount,
        currency: 'VND',
        status: classifyMomoStatus(resultCode),
      },
    };
  };

  const createPayment = async (
    input: CreatePaymentInput
  ): Promise<CreatePaymentResult> => {
    const {
      orderId,
      amount,
      orderInfo,
      ipnUrl,
      redirectUrl,
      requestId,
    } = input;

    // Build request body (all fields except signature, then sign alphabetically)
    const body: Record<string, unknown> = {
      partnerCode,
      accessKey,
      requestId,
      amount,
      orderId,
      orderInfo,
      orderType: 'momo_wallet',
      ipnUrl,
      redirectUrl,
      extraData: '',
      requestType: 'payWithATM',
      lang: 'vi',
    };

    const canonical = buildCanonicalString(body);
    const signature = hmacSha256(secretKey, canonical);

    const requestBody = { ...body, signature };

    try {
      const res = await fetchFn(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const json = (await res.json()) as Record<string, unknown>;

      if (json.resultCode !== 0) {
        return {
          ok: false,
          error: `momo_error:${json.resultCode}:${json.message ?? 'unknown'}`,
        };
      }

      return {
        ok: true,
        payUrl: String(json.payUrl ?? ''),
        externalRef: orderId,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'network_error',
      };
    }
  };

  return { createPayment, verifyWebhook };
}

/**
 * Singleton MoMo adapter that reads from getEnv().
 * Import this in production code.
 * For tests, use createMomoAdapter() directly with a fake fetch.
 */
let _momoAdapter: PaymentGateway | null = null;

export function getMomoAdapter(): PaymentGateway {
  if (_momoAdapter) return _momoAdapter;

  const env = getEnv();

  _momoAdapter = createMomoAdapter({
    partnerCode: env.MOMO_PARTNER_CODE,
    accessKey: env.MOMO_ACCESS_KEY,
    secretKey: env.MOMO_SECRET_KEY,
    endpoint: env.MOMO_ENDPOINT,
  });

  return _momoAdapter;
}

/** Reset cached adapter (test helper only). */
export function _resetMomoAdapter(): void {
  _momoAdapter = null;
}
