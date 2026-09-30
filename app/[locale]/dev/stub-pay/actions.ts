'use server';

/**
 * Dev-only stub-pay server action.
 *
 * Signs a self-issued IPN with STUB_PAYMENT_SECRET and feeds it through the
 * SAME processPaymentWebhook used by real gateways — verifyWebhook runs for
 * real, no HTTP self-fetch, no /api/* CSRF gate (Server Actions carry Next's
 * own origin check). Then redirects to the booking result page, which renders
 * the now-updated booking status.
 *
 * Guarded on NODE_ENV !== 'production' AND PAYMENTS_STUB. BOTH are required, and
 * the NODE_ENV half is the load-bearing one: this action signs an IPN for an
 * arbitrary caller-supplied orderId with the server's own key, and
 * processPaymentWebhook resolves the booking from that orderId without ever
 * comparing the inbound adapter against booking.paymentMethod. So on a production
 * deployment with PAYMENTS_STUB accidentally on, it is a zero-credential
 * "mark any booking paid" oracle — book by bank transfer, read your own
 * bookingRef off the confirmation page, POST it here, get a free ticket. No
 * signature to forge (the server signs), no CSRF (same-origin form post), no
 * rate limit (Server Actions are not under proxy.ts's /api/* gates).
 *
 * A dev payment stub has no business existing in a production deployment at all,
 * so the env flag alone was never the right gate — a single Vercel env edit should
 * not be able to arm this.
 */

import crypto from 'crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getEnv } from '@/lib/config';
import { assertDevActionAllowed } from '@/lib/dev/prodGuard';
import { getGatewayFor, type OnlinePaymentMethod } from '@/lib/payment';
import { buildStubIpn, type StubOutcome } from '@/lib/payment';
import { processPaymentWebhook } from '@/lib/payment';

const STUB_ADAPTERS = new Set<OnlinePaymentMethod>(['momo', 'zalopay', 'card', 'vnpay']);

/**
 * bank_transfer is the live SePay/VietQR rail, NOT a stubbed PSP — there is no
 * MoMo-shaped stub IPN and PAYMENTS_STUB does not govern it. So instead of the
 * in-process processPaymentWebhook path the stub PSPs take, this simulates SePay's
 * external delivery: it POSTs a synthetic SePay IPN to the REAL webhook route,
 * authenticated with the server's own SEPAY_API_KEY, so the e2e exercises the real
 * auth + adapter + confirm path end-to-end. Dev-only (the whole action is
 * prod-guarded); the real key never leaves the server.
 *
 * providerTxnId (the SePay `id`) is a deterministic function of the bookingRef, so a
 * replayed IPN collides on PaymentEvent @@unique([adapter, providerTxnId]) and the
 * webhook no-ops idempotently — the same property SePay's own redelivery relies on.
 */
async function postSyntheticSepayIpn(input: { bookingRef: string; amount: number }): Promise<void> {
  const env = getEnv();
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const base = host ? `${proto}://${host}` : '';

  // Stable positive integer (< 2^48, safe) derived from the ref → deterministic redelivery.
  const txnId = parseInt(
    crypto.createHash('sha256').update(input.bookingRef).digest('hex').slice(0, 12),
    16,
  );
  // Vietnamese bank memos strip the hyphens; the adapter re-inserts them (EXTRACT_REGEX).
  const memo = input.bookingRef.replace(/-/g, '');

  const ipn = {
    id: txnId,
    gateway: 'StubBank',
    transactionDate: '2026-01-01 00:00:00',
    // MUST equal the configured VietQR receiving account or the route holds it as an
    // orphan (Issue 334) instead of crediting — read the same env the route checks.
    accountNumber: env.VIETQR_ACCOUNT_NUMBER,
    subAccount: null,
    transferType: 'in',
    transferAmount: input.amount,
    accumulated: 0,
    code: null,
    content: `${memo} stub transfer`,
    referenceCode: `STUB-${txnId}`,
    description: `BankAPINotify ${memo}`,
  };

  const res = await fetch(`${base}/api/payments/bank_transfer/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // SePay's own scheme; the route accepts `Apikey`/`Bearer`. Real key, real auth.
      authorization: `Apikey ${env.SEPAY_API_KEY ?? ''}`,
    },
    body: JSON.stringify(ipn),
  });
  if (!res.ok) {
    throw new Error(`stub-pay: synthetic SePay IPN rejected (${res.status})`);
  }
}

export async function submitStubPayment(outcome: StubOutcome, formData: FormData): Promise<void> {
  assertDevActionAllowed(); // SEC-DEV-STUB-PROD-SAFETY (#559): shared prod guard.

  const adapter = String(formData.get('adapter') ?? '');
  const orderId = String(formData.get('orderId') ?? '');
  const amount = Number(formData.get('amount') ?? 0);
  const redirectUrl = String(formData.get('redirectUrl') ?? '');

  if (!orderId || !redirectUrl) {
    throw new Error('stub-pay: missing orderId/redirectUrl');
  }
  if (outcome !== 'success' && outcome !== 'fail') {
    throw new Error(`stub-pay: invalid outcome ${outcome}`);
  }

  // bank_transfer takes the real-route path above; only a successful inbound transfer
  // maps to an IPN (a "fail" is simply no transfer → booking stays awaiting_payment).
  if (adapter === 'bank_transfer') {
    if (outcome === 'success') {
      await postSyntheticSepayIpn({ bookingRef: orderId, amount });
    }
    redirect(redirectUrl);
  }

  const env = getEnv();
  if (!env.PAYMENTS_STUB) {
    throw new Error('stub-pay disabled: PAYMENTS_STUB is off');
  }
  if (!STUB_ADAPTERS.has(adapter as OnlinePaymentMethod)) {
    throw new Error(`stub-pay: unknown adapter ${adapter}`);
  }

  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';

  const ipn = buildStubIpn({
    secretKey: env.STUB_PAYMENT_SECRET,
    adapter,
    orderId,
    amount,
    outcome,
  });

  await processPaymentWebhook({
    rawBody: JSON.stringify(ipn),
    gateway: getGatewayFor(adapter as OnlinePaymentMethod, host ? `${proto}://${host}` : ''),
    adapter,
    proto,
    host,
  });

  // A real VNPay redirectUrl would be its signature-verifying return route, which
  // the browser only reaches WITH signed vnp_* params VNPay attaches. The stub
  // cannot mint those, so it stands in for VNPay's return leg directly — and that
  // route no longer exists (deleted with the unreachable PSP webhook surface;
  // re-adding one is a security decision, see
  // app/api/payments/__tests__/webhook-surface.test.ts). The webhook above already
  // set the authoritative
  // booking state, so we land the browser on the ref-addressed confirmation
  // (success) or error (fail) page — the same destinations the real return route
  // resolves to. Other adapters keep their result-page redirectUrl unchanged.
  if (adapter === 'vnpay') {
    redirect(
      outcome === 'success'
        ? `/booking/confirmation?ref=${encodeURIComponent(orderId)}`
        : `/booking/payment-error?ref=${encodeURIComponent(orderId)}&reason=stub_fail`
    );
  }

  redirect(redirectUrl);
}
