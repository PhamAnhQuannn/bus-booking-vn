/**
 * POST /api/admin/finance/orphan-payments/[id]/link (#331)
 *
 * Admin matched a memo-less (orphan) transfer to its booking against the bank statement.
 * Links the orphan PaymentEvent to the booking, then runs the reconcile sweep so the
 * booking is confirmed paid through the EXISTING paid path (shared guarded transition +
 * ledger + paid notices — exactly once). If the sweep is skipped (lock held by a cron
 * tick) or the booking is younger than the sweep threshold, the next tick pays it.
 *
 * Body: { bookingRef: string }.
 * 200 { ok:true, replay, bookingStatus } · 400 INVALID (non-uuid id, bad JSON) ·
 * 422 INVALID (bad body) · 404 PAYMENT_EVENT_NOT_FOUND · 404 BOOKING_NOT_FOUND ·
 * 409 ALREADY_LINKED (linked to another booking) · 409 BOOKING_NOT_AWAITING_PAYMENT ·
 * 422 AMOUNT_MISMATCH (not an exact, successful VND transfer of the fare) ·
 * 422 NOT_LINKABLE (resolved, foreign account, or non-bank-transfer event).
 *
 * Finance auth via financeRoute (TOTP + FINANCE/SUPER_ADMIN + step-up). Audited.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { AdminAuthContext } from '@/lib/auth';
import { writeAdminAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/core/db/client';
import { linkOrphanPayment, type LinkOrphanPaymentResult } from '@/lib/payment';
import { runJob, reconcilePayments } from '@/lib/jobs';
import { logger } from '@/lib/logger';
import { financeRoute, idAfterSegment, readJsonBody } from '../../../_shared';

const bodySchema = z.object({ bookingRef: z.string().trim().min(1).max(64) });
const uuidSchema = z.string().uuid();

type LinkError = Extract<LinkOrphanPaymentResult, { ok: false }>['error'];
const ERROR_RESPONSE: Record<LinkError, { code: string; status: number }> = {
  not_found: { code: 'PAYMENT_EVENT_NOT_FOUND', status: 404 },
  booking_not_found: { code: 'BOOKING_NOT_FOUND', status: 404 },
  already_linked: { code: 'ALREADY_LINKED', status: 409 },
  booking_not_awaiting_payment: { code: 'BOOKING_NOT_AWAITING_PAYMENT', status: 409 },
  amount_mismatch: { code: 'AMOUNT_MISMATCH', status: 422 },
  not_linkable: { code: 'NOT_LINKABLE', status: 422 },
};

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const paymentEventId = idAfterSegment(req, 'orphan-payments');
  if (!paymentEventId || !uuidSchema.safeParse(paymentEventId).success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.res;
  const body = bodySchema.safeParse(parsed.body);
  if (!body.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 422 });
  }

  const result = await linkOrphanPayment({ paymentEventId, bookingRef: body.data.bookingRef });
  if (!result.ok) {
    const { code, status } = ERROR_RESPONSE[result.error];
    return NextResponse.json({ error: code }, { status });
  }

  if (!result.replay) {
    await writeAdminAuditLog(prisma, {
      actor: `admin:${ctx.adminId}`,
      action: 'orphan-payment-link',
      target: paymentEventId,
      argsRedacted: JSON.stringify({ bookingRef: body.data.bookingRef }),
    });
  }

  // The link is committed; paying is the sweeper's job. A failure here only delays it
  // to the next cron tick, so it never fails the request.
  try {
    await runJob('reconcile-payments', reconcilePayments);
  } catch (err) {
    logger.error({ err, paymentEventId }, 'admin.orphan_link.reconcile_failed — next tick will pay');
  }
  const booking = await prisma.booking.findUnique({
    where: { id: result.bookingId },
    select: { status: true },
  });

  return NextResponse.json({ ok: true, replay: result.replay, bookingStatus: booking?.status ?? null });
}

export const POST = financeRoute(handler);
