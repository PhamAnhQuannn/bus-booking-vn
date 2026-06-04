/**
 * POST /api/admin/finance/refund-out (Issue 068)
 *
 * Admin issues a refund-out (cash back to the customer) for a paid booking,
 * recording the double-entry on the ledger. Reuses refundOut (Issue 051) which
 * owns the PSP call + the two ledger legs + replay idempotency.
 *
 * Body: { bookingId, amountMinor:int>0, reason:string }. The reason is the admin's
 * free-text justification (audited); refundOut's own `reason` is a constrained
 * RefundReason union, so we map the admin path to `operator_cancel` (the default
 * S15#2 refund trigger) and keep the admin's text in the audit row.
 *
 * idempotencyKey = `admin-refund:<uuid>` — fresh per request so every admin refund
 * is a DISTINCT refund event (the route is the gate; refundOut's replay layer then
 * protects against a re-POST of the same key). refundOut's result is mapped:
 * refunded → 200 { refunded:true }, alreadyDone → 200 { alreadyDone:true }.
 *
 * Finance auth via financeRoute. actor = `admin:<ctx.adminId>`. Audited.
 */

export const runtime = 'nodejs';

import { randomUUID } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { AdminAuthContext } from '@/lib/auth';
import { refundOut, RefundOutError } from '@/lib/ledger/refund';
import { writeAdminAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/core/db/client';
import { financeRoute, readJsonBody } from '../_shared';

const bodySchema = z.object({
  bookingId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  reason: z.string().min(1),
});

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.res;

  const body = bodySchema.safeParse(parsed.body);
  if (!body.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 422 });
  }

  const idempotencyKey = `admin-refund:${randomUUID()}`;

  try {
    const result = await refundOut({
      bookingId: body.data.bookingId,
      amountMinor: body.data.amountMinor,
      reason: 'operator_cancel',
      idempotencyKey,
    });

    await writeAdminAuditLog(prisma, {
      actor: `admin:${ctx.adminId}`,
      action: 'admin-refund-out',
      target: body.data.bookingId,
      argsRedacted: JSON.stringify({
        amountMinor: body.data.amountMinor,
        reason: body.data.reason,
        idempotencyKey,
        refunded: result.refunded,
        alreadyDone: result.alreadyDone,
      }),
    });

    return NextResponse.json({ refunded: result.refunded, alreadyDone: result.alreadyDone });
  } catch (e) {
    if (e instanceof RefundOutError) {
      // booking_not_found → 404; invalid_amount / not_refundable → 422.
      if (e.code === 'booking_not_found') {
        return NextResponse.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 });
      }
      return NextResponse.json({ error: e.code.toUpperCase() }, { status: 422 });
    }
    throw e;
  }
}

export const POST = financeRoute(handler);
