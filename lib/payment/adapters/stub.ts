/**
 * Local fake-gateway payment adapter (Phase 1).
 *
 * Implements PaymentGateway for ZaloPay + Card (and MoMo when PAYMENTS_STUB
 * is on) WITHOUT any real PSP credentials, so every online-payment user story
 * runs end-to-end locally.
 *
 * Flow:
 *   createPayment() → returns a payUrl to the dev stub-pay page
 *     (/dev/stub-pay) carrying orderId/amount/adapter/redirectUrl.
 *   The stub-pay page lets the tester click "Pay success" / "Pay fail",
 *     which signs a self-issued IPN with STUB_PAYMENT_SECRET (HMAC-SHA256)
 *     and feeds it through the SAME processPaymentWebhook path used by real
 *     gateways — so verifyWebhook is exercised for real, no HTTP self-fetch.
 *   verifyWebhook() → identical signature algorithm to MoMo, keyed by the
 *     dev-only STUB_PAYMENT_SECRET.
 *
 * Signature: HMAC-SHA256 over alphabetically-sorted canonical string of all
 * fields except "signature", joined with "&" (same as MoMo).
 *
 * Idempotency: stub transId is deterministic — `stub_${orderId}_${outcome}` —
 * so replaying the same outcome collides on PaymentEvent @@unique([adapter,
 * providerTxnId]) and exercises the 200-no-op path.
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

/** Result codes the stub emits. 0 = paid, 99 = failed. */
export const STUB_SUCCESS_CODE = 0;
export const STUB_FAILURE_CODE = 99;

function buildCanonicalString(obj: Record<string, unknown>): string {
  return Object.keys(obj)
    .filter((k) => k !== 'signature')
    .sort()
    .map((k) => `${k}=${obj[k]}`)
    .join('&');
}

function hmacSha256(secretKey: string, data: string): string {
  return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
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

export type StubOutcome = 'success' | 'fail';

/**
 * Build a fully-signed stub IPN payload for the given order + outcome.
 * The signed body still carries resultCode (0/99) which verifyWebhook maps
 * into the canonical status.
 */
export function buildStubIpn(input: {
  secretKey: string;
  adapter: string;
  orderId: string;
  amount: number;
  outcome: StubOutcome;
}): Record<string, unknown> {
  const { secretKey, adapter, orderId, amount, outcome } = input;
  const resultCode = outcome === 'success' ? STUB_SUCCESS_CODE : STUB_FAILURE_CODE;

  const payload: Record<string, unknown> = {
    partnerCode: `stub_${adapter}`,
    orderId,
    requestId: orderId,
    amount,
    transId: `stub_${orderId}_${outcome}`,
    resultCode,
    message: outcome === 'success' ? 'stub success' : 'stub failure',
    orderInfo: `stub:${adapter}`,
    orderType: adapter,
    payType: 'stub',
    responseTime: Date.now(),
    extraData: '',
  };

  const canonical = buildCanonicalString(payload);
  payload.signature = hmacSha256(secretKey, canonical);
  return payload;
}

/**
 * Deterministic stub PSP refund (Issue 051). Under PAYMENTS_STUB the refund
 * ALWAYS succeeds and the refund transaction id is a pure function of the
 * idempotency key — `stub_refund_<idempotencyKey>` — so a replay with the same
 * key produces the SAME refundTxnId and the caller's idempotent ledger writes
 * collide deterministically. No network, no PSP credentials.
 *
 * `providerTxnId` (the original inbound payment txn) and `amountMinor` are
 * accepted for signature-parity with the real adapter and for audit logging,
 * but the stub does not need them to compute the deterministic result.
 */
export function refundPaymentStub(input: {
  providerTxnId: string | null;
  amountMinor: number;
  idempotencyKey: string;
}): { ok: true; refundTxnId: string } {
  return { ok: true, refundTxnId: `stub_refund_${input.idempotencyKey}` };
}

export interface StubConfig {
  secretKey: string;
  baseUrl: string;
  /** Gateway label this stub stands in for: 'momo' | 'zalopay' | 'card'. */
  adapter: string;
}

/**
 * Create a stub adapter. `baseUrl` is needed so createPayment can point the
 * browser at the local stub-pay page.
 */
export function createStubAdapter(config: StubConfig): PaymentGateway {
  const { secretKey, baseUrl, adapter } = config;

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

    // Map the signed stub IPN into the canonical event. resultCode stays
    // internal: STUB_SUCCESS_CODE (0) → paid, STUB_FAILURE_CODE (99) → failed.
    // VND by construction.
    const resultCode = Number(parsed.resultCode ?? -1);
    const status: CanonicalPaymentStatus =
      resultCode === STUB_SUCCESS_CODE
        ? 'paid'
        : resultCode === STUB_FAILURE_CODE
          ? 'failed'
          : 'unknown';

    return {
      ok: true,
      event: {
        orderRef: String(parsed.orderId ?? ''),
        providerTxnId: String(parsed.transId ?? ''),
        amount: Number(parsed.amount ?? 0),
        currency: 'VND',
        status,
      },
    };
  };

  const createPayment = async (
    input: CreatePaymentInput
  ): Promise<CreatePaymentResult> => {
    const { orderId, amount, redirectUrl } = input;
    const params = new URLSearchParams({
      adapter,
      orderId,
      amount: String(amount),
      redirectUrl,
    });
    return {
      ok: true,
      payUrl: `${baseUrl}/dev/stub-pay?${params.toString()}`,
      externalRef: orderId,
    };
  };

  return { createPayment, verifyWebhook };
}

/**
 * Singleton stub adapters keyed by gateway label. baseUrl is fixed at first
 * call; tests should use createStubAdapter() directly.
 */
const _stubAdapters = new Map<string, PaymentGateway>();

export function getStubAdapter(adapter: string, baseUrl: string): PaymentGateway {
  const cached = _stubAdapters.get(adapter);
  if (cached) return cached;

  const built = createStubAdapter({
    secretKey: getEnv().STUB_PAYMENT_SECRET,
    baseUrl,
    adapter,
  });
  _stubAdapters.set(adapter, built);
  return built;
}

/** Reset cached stub adapters (test helper only). */
export function _resetStubAdapters(): void {
  _stubAdapters.clear();
}
