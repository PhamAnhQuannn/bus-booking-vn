/**
 * POST /api/admin/admins/[id]/reset-totp (Issue 057) — lost-TOTP recovery.
 *
 * SECURITY-CRITICAL. Requires an AUTHENTICATED + TOTP-verified SUPER_ADMIN
 * (requireAdminAuth) composed with a FRESH step-up (requireStepUp). Clears the
 * target admin's TOTP secret so they re-enroll on next login.
 *
 * The target admin id comes from the path. requireAdminAuth threads only
 * (req, ctx) to the handler, so the [id] segment is read off the request URL
 * rather than a Next params arg — both resolve to the same value, and reading the
 * URL keeps the handler signature compatible with the auth HOF.
 *
 * Maps no_self_reset→422, admin_not_found→404, forbidden→403, success→200 { ok }.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { requireStepUp } from '@/lib/auth/requireStepUp';
import { resetAdminTotp } from '@/lib/admin/resetAdminTotp';
import { AdminServiceError } from '@/lib/admin/errors';
import { withErrorHandler } from '@/lib/withErrorHandler';

/** Pull the [id] segment out of /api/admin/admins/<id>/reset-totp. */
function targetIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean);
  // .../admin/admins/<id>/reset-totp → <id> is the segment before the last.
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
    await resetAdminTotp(prisma, {
      actorAdminId: ctx.adminId,
      targetAdminId,
      actor: `admin:${ctx.adminId}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminServiceError) {
      if (e.code === 'no_self_reset') {
        return NextResponse.json({ error: 'NO_SELF_RESET' }, { status: 422 });
      }
      if (e.code === 'admin_not_found') {
        return NextResponse.json({ error: 'ADMIN_NOT_FOUND' }, { status: 404 });
      }
      if (e.code === 'forbidden') {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
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
