/**
 * POST /api/admin/finance/chargeback (Issue 068)
 *
 * Admin records a chargeback (bank-dispute reversal) for a paid booking. Reuses
 * recordChargeback (Issue 052) which owns the pre/post-payout sign logic + the
 * platform bad-debt backstop + replay idempotency.
 *
 * Body: { bookingId, amountMinor:int>0, sourceEventId? }. When sourceEventId is
 * omitted we mint `admin-chargeback:<uuid>` so each admin chargeback is distinct;
 * an explicit sourceEventId (e.g. the real PSP dispute id) is honoured so a real
 * webhook + an admin replay converge idempotently.
 *
 * Finance auth via financeRoute. actor = `admin:<ctx.adminId>`. Audited.
 */

export const runtime = 'nodejs';

import { randomUUID } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { AdminAuthContext } from '@/lib/auth';
import { recordChargeback, ChargebackError } from '@/lib/ledger';
import { writeAdminAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/core/db/client';
import { financeRoute, readJsonBody } from '../_shared';

const bodySchema = z.object({
  bookingId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  sourceEventId: z.string().min(1).optional(),
});

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.res;

  const body = bodySchema.safeParse(parsed.body);
  if (!body.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 422 });
  }

  const sourceEventId = body.data.sourceEventId ?? `admin-chargeback:${randomUUID()}`;

  try {
    const result = await recordChargeback({
      bookingId: body.data.bookingId,
      amountMinor: body.data.amountMinor,
      sourceEventId,
    });

    await writeAdminAuditLog(prisma, {
      actor: `admin:${ctx.adminId}`,
      action: 'admin-chargeback',
      target: body.data.bookingId,
      argsRedacted: JSON.stringify({
        amountMinor: body.data.amountMinor,
        sourceEventId,
        recorded: result.recorded,
        alreadyDone: result.alreadyDone,
        backstopped: result.backstopped,
      }),
    });

    return NextResponse.json({
      recorded: result.recorded,
      alreadyDone: result.alreadyDone,
      backstopped: result.backstopped,
    });
  } catch (e) {
    if (e instanceof ChargebackError) {
      if (e.code === 'booking_not_found') {
        return NextResponse.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 });
      }
      return NextResponse.json({ error: e.code.toUpperCase() }, { status: 422 });
    }
    throw e;
  }
}

export const POST = financeRoute(handler);
