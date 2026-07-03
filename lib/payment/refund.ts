/**
 * PSP refund dispatch (Issue 051) — MONEY-CRITICAL.
 *
 * Branches on the PAYMENTS_STUB flag:
 *   - PAYMENTS_STUB=true  → deterministic stub refund (always succeeds; refund
 *     txn id is a pure function of the idempotency key). This is the path every
 *     local / test refund takes today (real PSP credentials deferred per project
 *     memory: "real PSP/eSMS deferred; site runs fully on local stub gateway").
 *   - PAYMENTS_STUB=false → manual refund. Phase 1 uses bank transfer only,
 *     so no PSP refund API exists. Returns { ok: false, manualRefundRequired }
 *     and callers record the obligation + notify admin/operator. Real MoMo/
 *     ZaloPay refund API integration is deferred to issue 094.
 *
 * Idempotency: the refundTxnId is deterministic from `idempotencyKey`, so a
 * replay produces the identical result. The ledger writes (lib/ledger/refund.ts)
 * carry the real idempotency guarantee via unique sourceEventIds; this function
 * is the side-effecting PSP call that the ledger layer guards against replaying.
 */

import { getEnv } from '@/lib/config';
import { refundPaymentStub } from './adapters/stub';

export interface RefundPaymentInput {
  /** The original inbound payment provider txn id (Booking.paymentExternalRef). */
  providerTxnId: string | null;
  /** Refund amount in VND minor units (integer). */
  amountMinor: number;
  /** Refund idempotency key — DISTINCT from the inbound payment key (AC). */
  idempotencyKey: string;
}

export type RefundPaymentResult =
  | { ok: true; refundTxnId: string }
  | { ok: false; manualRefundRequired: true };

export async function refundPayment(
  input: RefundPaymentInput
): Promise<RefundPaymentResult> {
  const env = getEnv();

  if (env.PAYMENTS_STUB) {
    return refundPaymentStub(input);
  }

  // Phase 1: bank transfer only — no real PSP refund API. Return a
  // discriminated result so callers can record the obligation and notify
  // the operator to transfer manually. Real PSP integration lands in 094.
  return { ok: false, manualRefundRequired: true };
}
