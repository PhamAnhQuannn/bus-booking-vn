/**
 * POST /api/admin/system/admins/[id]/revoke (Issue 070) — disable an admin.
 *
 * SECURITY-CRITICAL. Requires an AUTHENTICATED + TOTP-verified SUPER_ADMIN
 * (requireAdminAuth) composed with a FRESH step-up (requireStepUp). Sets the target
 * AdminUser.status = 'DISABLED' (revokeAdmin); requireAdminAuth's per-request ACTIVE
 * check + the short access-token TTL evict their sessions with no extra step.
 *
 * The target admin id comes off the request URL (the auth HOF threads only
 * (req, ctx) — same pattern as reset-totp).
 *
 * Maps no_self_revoke→422, admin_not_found→404, success→200 { ok }.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { requireStepUp } from '@/lib/auth/requireStepUp';
import { revokeAdmin } from '@/lib/admin/revokeAdmin';
import { AdminServiceError } from '@/lib/admin/errors';
import { withErrorHandler } from '@/lib/withErrorHandler';

/** Pull the [id] segment out of /api/admin/system/admins/<id>/revoke. */
function targetIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('admins');
  if (idx === -1 || idx + 1 >= parts.length) return null;
  return decodeURIComponent(parts[idx + 1]) || null;
}

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const targetAdminId = targetIdFromUrl(req);
  if (!targetAdminId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  try {
    await revokeAdmin(prisma, {
      actorAdminId: ctx.adminId,
      targetAdminId,
      actor: `admin:${ctx.adminId}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminServiceError) {
      if (e.code === 'no_self_revoke') {
        return NextResponse.json({ error: 'NO_SELF_REVOKE' }, { status: 422 });
      }
      if (e.code === 'admin_not_found') {
        return NextResponse.json({ error: 'ADMIN_NOT_FOUND' }, { status: 404 });
      }
    }
    throw e;
  }
}

export const POST = withErrorHandler(
  requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })(
    requireStepUp(handler)
  ) as (req: NextRequest) => Promise<Response>
);
