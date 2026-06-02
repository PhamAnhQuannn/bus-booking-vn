/**
 * POST /api/admin/auth/totp/enroll (Issue 055)
 *
 * Phase 1 of TOTP enrollment. Accessible to any AUTHENTICATED admin (requireTotp
 * is FALSE here — the admin hasn't cleared TOTP yet because they're enrolling).
 *
 * Returns 200 { secret, otpauthUri } — the admin scans the otpauth URI into their
 * authenticator, then POSTs the first code to /confirm. No session change here.
 *
 * If TOTP is already enabled → 409 { error: 'ALREADY_ENROLLED' } (re-enrollment is
 * a separate step-up-gated flow; this endpoint never silently rotates a live secret).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { beginEnrollment } from '@/lib/auth/adminTotp';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';

async function handler(_req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  try {
    const { secret, otpauthUri } = await beginEnrollment(ctx.adminId);
    return NextResponse.json({ secret, otpauthUri });
  } catch (err) {
    if (err instanceof Error && err.message === 'already_enrolled') {
      return NextResponse.json({ error: 'ALREADY_ENROLLED' }, { status: 409 });
    }
    throw err;
  }
}

export const POST = withErrorHandler(
  requireAdminAuth({ requireTotp: false })(handler) as (req: NextRequest) => Promise<Response>
);
