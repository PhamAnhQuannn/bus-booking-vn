/**
 * POST /api/admin/charter/[id]/assign-direct (Issue 085)
 *
 * Routes a charter lead ADMIN_REVIEW → ASSIGNED_DIRECT to a specific operator.
 * Role-gated (SUPER_ADMIN | SUPPORT) + TOTP. NO step-up — dispatching a sales lead
 * is an ops action, not a money movement.
 *
 * Body: { operatorId: string }. The operator MUST be APPROVED (validated here →
 * 422 NOT_APPROVED otherwise) so we never direct-assign a lead to a pending /
 * suspended / rejected operator.
 *
 * The accept deadline (acceptByAt = now + 24h, Issue 083) is computed HERE in the
 * route handler — Date.now() in a route handler is fine (not an RSC render body,
 * AGENTS.md Issue 016) — and passed into the transition. The transition writes
 * assigneeOperatorId + acceptByAt + the admin AdminAuditLog row in one tx.
 *
 * Maps bad body→400, not-APPROVED operator→422, illegal_transition→422,
 * charter_not_found→404.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { transitionCharterRequest, CharterError } from '@/lib/charter';
import { prisma } from '@/lib/db/client';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { charterIdFromUrl, mapCharterError } from '../_shared';

/** Direct-assign accept window (Issue 083): operator has 24h to accept. */
const ACCEPT_WINDOW_MS = 24 * 3600 * 1000;

const bodySchema = z.object({ operatorId: z.string().min(1) });

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

  // The target must be an APPROVED operator — never direct-assign to a
  // pending/suspended/rejected one.
  const operator = await prisma.operator.findUnique({
    where: { id: parsed.data.operatorId },
    select: { status: true },
  });
  if (!operator || operator.status !== 'APPROVED') {
    return NextResponse.json({ error: 'NOT_APPROVED' }, { status: 422 });
  }

  try {
    await transitionCharterRequest(prisma, {
      charterId,
      to: 'ASSIGNED_DIRECT',
      assigneeOperatorId: parsed.data.operatorId,
      acceptByAt: new Date(Date.now() + ACCEPT_WINDOW_MS),
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
