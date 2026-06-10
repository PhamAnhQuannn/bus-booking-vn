/**
 * POST /api/admin/operators/[id]/create-account (2026-06-06, S05)
 *
 * Provisions the operator's bootstrap login account from an existing PENDING_REVIEW
 * application: generates username + temp password, flips the operator to APPROVED,
 * audit-logs the action, and enqueues the credentials email. PRIVILEGED — composes
 * requireStepUp on top of requireAdminAuth({requireTotp, SUPER_ADMIN}).
 *
 * Returns 201 { username, tempPassword } — the temp password is shown ONCE to the
 * admin as a fallback to the emailed copy; it is never persisted in plaintext.
 *
 * Maps operator_not_found → 404, account_already_exists → 409.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth';
import { requireStepUp } from '@/lib/auth';
import { prisma } from '@/lib/core/db/client';
import { createOperatorAccount, AdminServiceError } from '@/lib/admin';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { operatorIdFromUrl } from '../_shared';

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const operatorId = operatorIdFromUrl(req);
  if (!operatorId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  const host =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3001';
  const baseUrl = `${proto}://${host}`;

  try {
    const result = await createOperatorAccount(prisma, {
      operatorId,
      baseUrl,
      actor: `admin:${ctx.adminId}`,
    });
    return NextResponse.json(
      { username: result.username, tempPassword: result.tempPassword },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof AdminServiceError) {
      if (e.code === 'operator_not_found') {
        return NextResponse.json({ error: 'OPERATOR_NOT_FOUND' }, { status: 404 });
      }
      if (e.code === 'account_already_exists') {
        return NextResponse.json({ error: 'ACCOUNT_ALREADY_EXISTS' }, { status: 409 });
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
