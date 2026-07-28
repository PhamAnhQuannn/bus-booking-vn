/**
 * Single source of truth for "may a customer choose VNPay right now?".
 *
 * VNPay's entire callback surface — POST /api/payments/vnpay/webhook and GET
 * /api/payments/vnpay/return — was deleted along with the other unreachable PSP
 * webhook routes. Only ONE way to complete a vnpay payment survives: the stub's
 * in-process return leg in app/dev/stub-pay/actions.ts, which calls
 * processPaymentWebhook directly rather than over HTTP.
 *
 * That makes VNPAY_ENABLED actively dangerous as a selectability gate. Flipping it
 * (the documented next step for the VNPay rollout) sends a customer to VNPay's real
 * hosted page with real money, and there is no longer any route for VNPay's IPN or
 * its browser return to land on — the payment succeeds at the PSP and the app never
 * learns. Worse than a plain outage: no PaymentEvent row is written, so the
 * reconcile sweeper has nothing to recover from either.
 *
 * So selectability is gated on the stub path being REACHABLE, not on VNPAY_ENABLED:
 * PAYMENTS_STUB on, and not a production deployment (the stub-pay page itself is
 * non-production-only). Re-enabling real VNPay means restoring both routes first —
 * and the moment they exist, this predicate is the wrong shape and must change with
 * them.
 *
 * Lives here, imported by BOTH the initiate route and the review page's `showVnpay`,
 * because those two were previously independent copies joined only by a
 * "MIRRORS the UI" comment — the classic setup for a silent divergence.
 */

import { getEnv } from '@/lib/config';

export function isVnpaySelectable(): boolean {
  return getEnv().PAYMENTS_STUB && process.env.NODE_ENV !== 'production';
}
