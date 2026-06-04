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
 * Guarded: only callable when PAYMENTS_STUB is on. Refuses in real-payment mode.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getEnv } from '@/lib/config';
import { getGatewayFor, type OnlinePaymentMethod } from '@/lib/payment/select';
import { buildStubIpn, type StubOutcome } from '@/lib/payment/adapters/stub';
import { processPaymentWebhook } from '@/lib/payment/processWebhook';

const STUB_ADAPTERS = new Set<OnlinePaymentMethod>(['momo', 'zalopay', 'card']);

export async function submitStubPayment(formData: FormData): Promise<void> {
  const env = getEnv();
  if (!env.PAYMENTS_STUB) {
    throw new Error('stub-pay disabled: PAYMENTS_STUB is off');
  }

  const adapter = String(formData.get('adapter') ?? '');
  const orderId = String(formData.get('orderId') ?? '');
  const amount = Number(formData.get('amount') ?? 0);
  const redirectUrl = String(formData.get('redirectUrl') ?? '');
  const outcome = String(formData.get('outcome') ?? '') as StubOutcome;

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

  redirect(redirectUrl);
}
