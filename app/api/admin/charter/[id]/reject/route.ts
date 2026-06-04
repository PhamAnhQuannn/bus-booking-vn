/**
 * POST /api/admin/charter/[id]/reject (Issue 085)
 *
 * Routes a charter lead ADMIN_REVIEW → REJECTED (admin declines to route the
 * request) with a required reason. Role-gated (SUPER_ADMIN | SUPPORT) + TOTP. NO
 * step-up.
 *
 * Body: { reason: string (min 1) }. The reason is persisted on the CharterRequest
 * (rejectionReason) and recorded in the admin AdminAuditLog row by the transition
 * service, both in one tx.
 *
 * Maps bad body→400, illegal_transition→422, charter_not_found→404.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth';
import { transitionCharterRequest, CharterError } from '@/lib/charter';
import { prisma } from '@/lib/core/db/client';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { charterIdFromUrl, mapCharterError } from '../_shared';

const bodySchema = z.object({ reason: z.string().min(1) });

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const charterId = charterIdFromUrl(req);
  if (!charterId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  try {
    await transitionCharterRequest(prisma, {
      charterId,
      to: 'REJECTED',
      rejectionReason: parsed.data.reason,
      actor: `admin:${ctx.adminId}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CharterError) {
      return mapCharterError(e);
    }
    throw e;
  }
}

export const POST = withErrorHandler(
  requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'SUPPORT'] })(handler) as (
    req: NextRequest
  ) => Promise<Response>
);
