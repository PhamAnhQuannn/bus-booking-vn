/**
 * PSP refund dispatch (Issue 051) — MONEY-CRITICAL.
 *
 * Branches on the PAYMENTS_STUB flag:
 *   - PAYMENTS_STUB=true  → deterministic stub refund (always succeeds; refund
 *     txn id is a pure function of the idempotency key). This is the path every
 *     local / test refund takes today (real PSP credentials deferred per project
 *     memory: "real PSP/eSMS deferred; site runs fully on local stub gateway").
 *   - PAYMENTS_STUB=false → real PSP refund. NOT YET IMPLEMENTED. Real MoMo/
 *     ZaloPay refund API integration is deferred to the go-live payment-keys
 *     issue (094). Until then this branch throws 'psp_refund_not_implemented'
 *     so a non-stub deployment fails LOUDLY rather than silently skipping the
 *     cash leg of a refund.
 *
 * Idempotency: the refundTxnId is deterministic from `idempotencyKey`, so a
 * replay produces the identical result. The ledger writes (lib/ledger/refund.ts)
 * carry the real idempotency guarantee via unique sourceEventIds; this function
 * is the side-effecting PSP call that the ledger layer guards against replaying.
 */

import { getEnv } from '@/lib/config/env';
import { refundPaymentStub } from './adapters/stub';

export interface RefundPaymentInput {
  /** The original inbound payment provider txn id (Booking.paymentExternalRef). */
  providerTxnId: string | null;
  /** Refund amount in VND minor units (integer). */
  amountMinor: number;
  /** Refund idempotency key — DISTINCT from the inbound payment key (AC). */
  idempotencyKey: string;
}

export interface RefundPaymentResult {
  ok: true;
  refundTxnId: string;
}

/** Thrown when a real (non-stub) PSP refund is attempted before 094 lands. */
export class PspRefundNotImplementedError extends Error {
  constructor() {
    super('psp_refund_not_implemented');
    this.name = 'PspRefundNotImplementedError';
  }
}

export async function refundPayment(
  input: RefundPaymentInput
): Promise<RefundPaymentResult> {
  const env = getEnv();

  if (env.PAYMENTS_STUB) {
    return refundPaymentStub(input);
  }

  // TODO(094-go-live-real-payment-keys): integrate the real MoMo/ZaloPay refund
  // API here (call the PSP refund endpoint, verify the response, surface the
  // PSP refund txn id). Until then a real deployment MUST fail loudly.
  throw new PspRefundNotImplementedError();
}
