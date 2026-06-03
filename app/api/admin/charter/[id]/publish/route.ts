/**
 * POST /api/admin/charter/[id]/publish (Issue 085)
 *
 * Routes a charter lead ADMIN_REVIEW → PUBLISHED into the public operator pool
 * (Issue 084). Role-gated (SUPER_ADMIN | SUPPORT) + TOTP. NO step-up.
 *
 * The claim deadline (claimByAt = now + 48h, Issue 084) is computed HERE in the
 * route handler (Date.now() in a route handler is fine — AGENTS.md Issue 016) and
 * passed into the transition. The transition stamps publishedAt + claimByAt + the
 * admin AdminAuditLog row in one tx.
 *
 * Maps illegal_transition→422, charter_not_found→404.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { transitionCharterRequest, CharterError } from '@/lib/charter';
import { prisma } from '@/lib/db/client';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { charterIdFromUrl, mapCharterError } from '../_shared';

/** Public-pool claim window (Issue 084): operators have 48h to claim. */
const CLAIM_WINDOW_MS = 48 * 3600 * 1000;

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const charterId = charterIdFromUrl(req);
  if (!charterId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  try {
    await transitionCharterRequest(prisma, {
      charterId,
      to: 'PUBLISHED',
      claimByAt: new Date(Date.now() + CLAIM_WINDOW_MS),
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
