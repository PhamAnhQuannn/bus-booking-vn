/**
 * POST /api/admin/customers/[id]/reinstate (Issue 066)
 *
 * Clears Customer.suspendedAt and writes a 'reinstate-customer' audit row. Revoked
 * sessions are NOT restored — the customer logs in fresh (see reinstateCustomer).
 *
 * AUTH: TOTP-verified admin, role SUPER_ADMIN or SUPPORT. actor = "admin:<id>".
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/core/db/client';
import { reinstateCustomer } from '@/lib/admin/suspendCustomer';
import { customerIdFromUrl } from '../_shared';

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const customerId = customerIdFromUrl(req);
  if (!customerId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  await reinstateCustomer(prisma, { customerId, actor: `admin:${ctx.adminId}` });
  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandler(
  requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'SUPPORT'] })(handler) as (
    req: NextRequest
  ) => Promise<Response>
);
