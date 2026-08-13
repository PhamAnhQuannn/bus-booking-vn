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

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getEnv } from '@/lib/config';
import { assertDevActionAllowed } from '@/lib/dev/prodGuard';
import { getGatewayFor, type OnlinePaymentMethod } from '@/lib/payment';
import { buildStubIpn, type StubOutcome } from '@/lib/payment';
import { processPaymentWebhook } from '@/lib/payment';

const STUB_ADAPTERS = new Set<OnlinePaymentMethod>(['momo', 'zalopay', 'card', 'vnpay']);

export async function submitStubPayment(outcome: StubOutcome, formData: FormData): Promise<void> {
  assertDevActionAllowed(); // SEC-DEV-STUB-PROD-SAFETY (#559): shared prod guard.
  const env = getEnv();
  if (!env.PAYMENTS_STUB) {
    throw new Error('stub-pay disabled: PAYMENTS_STUB is off');
  }

  const adapter = String(formData.get('adapter') ?? '');
  const orderId = String(formData.get('orderId') ?? '');
  const amount = Number(formData.get('amount') ?? 0);
  const redirectUrl = String(formData.get('redirectUrl') ?? '');

  if (!STUB_ADAPTERS.has(adapter as OnlinePaymentMethod)) {
    throw new Error(`stub-pay: unknown adapter ${adapter}`);
  }
  if (!orderId || !redirectUrl) {
    throw new Error('stub-pay: missing orderId/redirectUrl');
  }
  if (outcome !== 'success' && outcome !== 'fail') {
    throw new Error(`stub-pay: invalid outcome ${outcome}`);
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
