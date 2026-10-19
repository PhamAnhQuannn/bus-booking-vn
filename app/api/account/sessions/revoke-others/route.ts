/**
 * POST /api/account/sessions/revoke-others (#497)
 * No body. Bearer auth required; X-CSRF-Token required (double-submit — enforced by middleware).
 *
 * "Sign out of all other devices": revokes every live session of the caller EXCEPT the
 * current device's token family, identified from the HttpOnly bb_rt refresh cookie.
 *
 * Status map:
 *   200 { revoked: n }          — success (n may be 0)
 *   400 SESSION_UNKNOWN         — bb_rt missing/invalid/not this customer's → nothing revoked
 *                                 (never fall back to revoking everything blindly)
 *   401 UNAUTHORIZED            — missing/invalid Bearer token (requireCustomerAuth)
 *   429 RATE_LIMITED            — 5/15min per customer
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withErrorHandler } from '@/lib/withErrorHandler';
import {
  requireCustomerAuth,
  findCustomerSessionIdByRefresh,
  revokeOtherCustomerSessions,
} from '@/lib/auth';
import { accountRevokeOthersRatelimit } from '@/lib/ratelimit';

async function handler(_req: NextRequest, { customerId }: { customerId: string }): Promise<Response> {
  const rl = await accountRevokeOthersRatelimit.limit(`account-revoke-others:${customerId}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  const cookieStore = await cookies();
  const rt = cookieStore.get('bb_rt')?.value;
  const keepSessionId = rt ? await findCustomerSessionIdByRefresh(rt, customerId) : null;
  if (!keepSessionId) {
    return NextResponse.json({ error: 'SESSION_UNKNOWN' }, { status: 400 });
  }

  const result = await revokeOtherCustomerSessions(customerId, keepSessionId);
  if (!result) {
    return NextResponse.json({ error: 'SESSION_UNKNOWN' }, { status: 400 });
  }
  return NextResponse.json({ revoked: result.revoked });
}

export const POST = withErrorHandler(requireCustomerAuth()(handler));
