/**
 * Admin close-out of money still owed to a customer (#833, #851). MONEY-CRITICAL.
 *
 * - markManualRefundPaid: a RefundObligation in 'manual_pending' (refundOut ran on the no-PSP
 *   manual rail; ledger legs already written) → 'done' + manualPaidAt + manualBankRef, once the
 *   admin has made the bank transfer. No ledger write: refundOut already recorded refund_out.
 * - resolveUnfulfilledPayment: a LINKED PaymentEvent tagged late / duplicate / underpaid →
 *   resolvedAt + resolvedBankRef, so it drops out of the admin tile.
 *
 * Both are read-then-write on a single gating row: callback-form $transaction with
 * SELECT ... FOR UPDATE, so two concurrent admin clicks cannot both "pay" the same row.
 * Discriminated results (no thrown sentinels — Issue 013); the route maps them to status codes.
 */

import { prisma } from '@/lib/core/db/client';
import { MANUAL_REFUND_PENDING } from './refundOut';
import { UNFULFILLED_REASON } from './processWebhook';

export type MarkManualRefundPaidResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'not_owed' };

export async function markManualRefundPaid(input: {
  obligationId: string;
  bankRef: string;
  now: Date;
}): Promise<MarkManualRefundPaidResult> {
  const { obligationId, bankRef, now } = input;
  return prisma.$transaction(async (tx) => {
    // RefundObligation ids are cuid TEXT — no ::uuid cast.
    const rows = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT "status" FROM "RefundObligation" WHERE "id" = ${obligationId} FOR UPDATE
    `;
    if (rows.length === 0) return { ok: false, error: 'not_found' };
    if (rows[0].status !== MANUAL_REFUND_PENDING) return { ok: false, error: 'not_owed' };

    await tx.refundObligation.update({
      where: { id: obligationId },
      data: { status: 'done', manualPaidAt: now, manualBankRef: bankRef },
    });
    return { ok: true };
  });
}

export type ResolveUnfulfilledPaymentResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'not_resolvable' };

const UNFULFILLED = new Set<string>(Object.values(UNFULFILLED_REASON));

export async function resolveUnfulfilledPayment(input: {
  paymentEventId: string;
  bankRef: string;
  now: Date;
}): Promise<ResolveUnfulfilledPaymentResult> {
  const { paymentEventId, bankRef, now } = input;
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ bookingId: string | null; unmatchedReason: string | null; resolvedAt: Date | null }>
    >`
      SELECT "bookingId", "unmatchedReason", "resolvedAt"
      FROM "PaymentEvent" WHERE "id" = ${paymentEventId}::uuid FOR UPDATE
    `;
    if (rows.length === 0) return { ok: false, error: 'not_found' };
    const ev = rows[0];
    // Only linked, unfulfilled, still-open events. Orphans are reconciled by claiming a match.
    if (
      ev.bookingId === null ||
      ev.unmatchedReason === null ||
      !UNFULFILLED.has(ev.unmatchedReason) ||
      ev.resolvedAt !== null
    ) {
      return { ok: false, error: 'not_resolvable' };
    }

    await tx.paymentEvent.update({
      where: { id: paymentEventId },
      data: { resolvedAt: now, resolvedBankRef: bankRef },
    });
    return { ok: true };
  });
}
