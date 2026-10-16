/**
 * POST /api/admin/finance/orphan-payments/[id]/resolve (#331)
 *
 * Admin closes out an ORPHAN PaymentEvent (bookingId NULL) after settling it by hand —
 * refunded to the sender, or not our money: sets resolvedAt + resolvedBankRef. It drops
 * out of the reconciliation list + the orphan tile, and stops holding any booking on
 * suspicion (that booking then expires on the next reconcile tick). Linked events use
 * /unfulfilled-payments/[id]/resolve (#851) instead.
 *
 * Body: { bankRef: string } — bank transaction reference (or settlement note), 1–100 chars.
 * 200 { ok:true } · 400 INVALID (non-uuid id, bad JSON) · 422 INVALID (bad body) ·
 * 404 PAYMENT_EVENT_NOT_FOUND · 422 NOT_RESOLVABLE (linked, or already resolved).
 *
 * Finance auth via financeRoute (TOTP + FINANCE/SUPER_ADMIN + step-up). Audited.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { AdminAuthContext } from '@/lib/auth';
import { writeAdminAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/core/db/client';
import { resolveOrphanPayment } from '@/lib/payment';
import { financeRoute, idAfterSegment, readJsonBody } from '../../../_shared';

const bodySchema = z.object({ bankRef: z.string().trim().min(1).max(100) });
const uuidSchema = z.string().uuid();

/** Request-boundary clock (kept out of the service so tests can pin it there). */
function requestNow(): Date {
  return new Date();
}

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

  const result = await resolveOrphanPayment({
    paymentEventId,
    bankRef: body.data.bankRef,
    now: requestNow(),
  });
  if (!result.ok) {
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'PAYMENT_EVENT_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: 'NOT_RESOLVABLE' }, { status: 422 });
  }

  await writeAdminAuditLog(prisma, {
    actor: `admin:${ctx.adminId}`,
    action: 'orphan-payment-resolve',
    target: paymentEventId,
    argsRedacted: JSON.stringify({ bankRef: body.data.bankRef }),
  });

  return NextResponse.json({ ok: true });
}

export const POST = financeRoute(handler);
