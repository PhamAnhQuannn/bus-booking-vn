/**
 * POST /api/admin/finance/unfulfilled-payments/[id]/resolve (#851)
 *
 * Admin closes out a LINKED PaymentEvent whose money could not be applied (late after
 * expiry / duplicate on a paid booking / underpaid) after settling it by hand: sets
 * resolvedAt + resolvedBankRef so it drops out of the "Chuyển khoản không áp dụng được" tile.
 *
 * Body: { bankRef: string } — bank transaction reference (or settlement note), 1–100 chars.
 * 200 { ok:true } · 400 INVALID (missing/non-uuid id, bad JSON) · 422 INVALID (bad body) ·
 * 404 PAYMENT_EVENT_NOT_FOUND · 422 NOT_RESOLVABLE (orphan, not unfulfilled, or already resolved).
 *
 * Finance auth via financeRoute (TOTP + FINANCE/SUPER_ADMIN + step-up). Audited.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { AdminAuthContext } from '@/lib/auth';
import { writeAdminAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/core/db/client';
import { resolveUnfulfilledPayment } from '@/lib/payment';
import { financeRoute, idAfterSegment, readJsonBody } from '../../../_shared';

const bodySchema = z.object({ bankRef: z.string().trim().min(1).max(100) });
const uuidSchema = z.string().uuid();

/** Request-boundary clock (kept out of the service so tests can pin it there). */
function requestNow(): Date {
  return new Date();
}

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const paymentEventId = idAfterSegment(req, 'unfulfilled-payments');
  // PaymentEvent ids are uuid; a malformed one would fail the ::uuid cast with a 500.
  if (!paymentEventId || !uuidSchema.safeParse(paymentEventId).success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.res;
  const body = bodySchema.safeParse(parsed.body);
  if (!body.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 422 });
  }

  const result = await resolveUnfulfilledPayment({
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
    action: 'unfulfilled-payment-resolve',
    target: paymentEventId,
    argsRedacted: JSON.stringify({ bankRef: body.data.bankRef }),
  });

  return NextResponse.json({ ok: true });
}

export const POST = financeRoute(handler);
