/**
 * POST /api/admin/system/admins/[id]/role (Issue 070) — change an admin's role.
 *
 * SECURITY-CRITICAL. Requires an AUTHENTICATED + TOTP-verified SUPER_ADMIN
 * (requireAdminAuth) composed with a FRESH step-up (requireStepUp). Updates the
 * target AdminUser.role (setAdminRole). The DB role is authoritative — a downgrade
 * takes effect on the target's next request within the access-token TTL.
 *
 * Body: { role }. The target admin id comes off the request URL (the auth HOF
 * threads only (req, ctx) — same pattern as reset-totp / revoke).
 *
 * Maps no_self_role_change→422, invalid_role→422, admin_not_found→404, 200 { ok }.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/core/db/client';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth';
import { requireStepUp } from '@/lib/auth';
import { setAdminRole } from '@/lib/admin/setAdminRole';
import { AdminServiceError } from '@/lib/admin/errors';
import { withErrorHandler } from '@/lib/withErrorHandler';

const bodySchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'FINANCE', 'SUPPORT']),
});

/** Pull the [id] segment out of /api/admin/system/admins/<id>/role. */
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    // Bad / unknown role value → 422 (validation failure, not a malformed request).
    return NextResponse.json({ error: 'INVALID_ROLE' }, { status: 422 });
  }

  try {
    await setAdminRole(prisma, {
      actorAdminId: ctx.adminId,
      targetAdminId,
      role: parsed.data.role,
      actor: `admin:${ctx.adminId}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminServiceError) {
      if (e.code === 'no_self_role_change') {
        return NextResponse.json({ error: 'NO_SELF_ROLE_CHANGE' }, { status: 422 });
      }
      if (e.code === 'invalid_role') {
        return NextResponse.json({ error: 'INVALID_ROLE' }, { status: 422 });
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
