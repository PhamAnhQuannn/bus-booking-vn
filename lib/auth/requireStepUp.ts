/**
 * requireStepUp — step-up (re-auth) gate for high-sensitivity admin actions
 * (Issue 055). Composes ON TOP of an authenticated + TOTP-verified admin: it
 * does NOT re-authenticate, it only confirms a FRESH step-up token is present.
 *
 * Reads the `bb_admin_stepup` cookie, verifyAdminStepUp, and requires the token's
 * subject to match the already-authenticated ctx.adminId. The step-up token is
 * minted (300s TTL) by POST /api/admin/auth/step-up after a fresh TOTP verify.
 *
 * USAGE (Wave-3 finance / approval routes):
 *
 *   import { requireAdminAuth } from '@/lib/auth/requireAdminAuth';
 *   import { requireStepUp } from '@/lib/auth/requireStepUp';
 *
 *   async function handler(req: NextRequest, ctx: AdminAuthContext) { ... }
 *
 *   // Outer: authenticate + role + TOTP. Inner: step-up freshness.
 *   export const POST = requireAdminAuth({ role: 'FINANCE', requireTotp: true })(
 *     requireStepUp(handler)
 *   );
 *
 * On a missing/invalid/mismatched step-up token → 403 { error: 'STEP_UP_REQUIRED' };
 * the client then drives the user through POST /api/admin/auth/step-up and retries.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminStepUp } from './jwt';
import type { AdminAuthContext } from './requireAdminAuth';

export const ADMIN_STEPUP_COOKIE = 'bb_admin_stepup';

type StepUpHandler = (req: NextRequest, ctx: AdminAuthContext) => Promise<Response>;

/**
 * Wrap an admin handler so it only runs with a valid, non-expired step-up token
 * whose subject matches the authenticated admin. Intended to be composed INSIDE
 * requireAdminAuth({ requireTotp: true }) so ctx is already populated.
 */
export function requireStepUp(handler: StepUpHandler): StepUpHandler {
  return async (req: NextRequest, ctx: AdminAuthContext): Promise<Response> => {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(ADMIN_STEPUP_COOKIE);

    if (!tokenCookie?.value) {
      return NextResponse.json({ error: 'STEP_UP_REQUIRED' }, { status: 403 });
    }

    const payload = await verifyAdminStepUp(tokenCookie.value);
    // sub must match the authenticated admin — a step-up token minted for a
    // different admin must never satisfy this gate.
    if (!payload || payload.sub !== ctx.adminId) {
      return NextResponse.json({ error: 'STEP_UP_REQUIRED' }, { status: 403 });
    }

    return handler(req, ctx);
  };
}
