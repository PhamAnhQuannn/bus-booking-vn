/**
 * POST /api/admin/admins (Issue 057) — invite a new AdminUser.
 *
 * SECURITY-CRITICAL. Requires an AUTHENTICATED + TOTP-verified SUPER_ADMIN
 * (requireAdminAuth) composed with a FRESH step-up (requireStepUp). The temp
 * password is returned 201 in the response body to the authenticated super-admin
 * ONLY, over the already-authenticated channel — the inviter conveys it to the
 * invitee out-of-band. The invitee enrolls TOTP on first login.
 *
 * Body: { email, role }. Maps email_in_use→409, forbidden→403.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { requireStepUp } from '@/lib/auth/requireStepUp';
import { inviteAdmin } from '@/lib/admin/inviteAdmin';
import { AdminServiceError } from '@/lib/admin/errors';
import { withErrorHandler } from '@/lib/withErrorHandler';

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['SUPER_ADMIN', 'FINANCE', 'SUPPORT']),
});

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
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
    const result = await inviteAdmin(prisma, {
      inviterAdminId: ctx.adminId,
      email: parsed.data.email,
      role: parsed.data.role,
      actor: `admin:${ctx.adminId}`,
    });
    return NextResponse.json(
      { adminUserId: result.adminUserId, tempPassword: result.tempPassword },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof AdminServiceError) {
      if (e.code === 'email_in_use') {
        return NextResponse.json({ error: 'EMAIL_IN_USE' }, { status: 409 });
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
