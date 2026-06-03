/**
 * POST /api/admin/customers/[id]/suspend (Issue 066)
 *
 * Admin-suspends a customer: stamps Customer.suspendedAt, revokes all the customer's
 * live sessions, and writes a 'suspend-customer' audit row (see suspendCustomer).
 *
 * AUTH: TOTP-verified admin, role SUPER_ADMIN or SUPPORT (SUPPORT triages users per
 * the admin role matrix; finance roles are not user moderators). actor = "admin:<id>".
 * Idempotent — re-suspending re-stamps + re-revokes (both no-ops in steady state).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/db/client';
import { suspendCustomer } from '@/lib/admin/suspendCustomer';
import { customerIdFromUrl } from '../_shared';

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const customerId = customerIdFromUrl(req);
  if (!customerId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  await suspendCustomer(prisma, { customerId, actor: `admin:${ctx.adminId}` });
  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandler(
  requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'SUPPORT'] })(handler) as (
    req: NextRequest
  ) => Promise<Response>
);
