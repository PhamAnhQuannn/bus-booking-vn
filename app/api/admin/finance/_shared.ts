/**
 * Shared helpers for the /api/admin/finance/* routes (Issue 068).
 *
 * Every finance route is the SAME auth shape (mirror — do not re-derive per file):
 *   requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] })(
 *     requireStepUp(handler)
 *   )
 * `financeGuard(handler)` composes that once; each route exports
 *   export const POST = withErrorHandler(financeGuard(handler));
 *
 * Also exports a path-segment parser for the dynamic `payouts/[id]/*` routes and
 * a tiny JSON-body reader that 400s on un-parseable input.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { requireStepUp } from '@/lib/auth/requireStepUp';
import { withErrorHandler } from '@/lib/withErrorHandler';

type FinanceHandler = (req: NextRequest, ctx: AdminAuthContext) => Promise<Response>;

/**
 * Compose the canonical finance auth chain (TOTP + FINANCE/SUPER_ADMIN role +
 * fresh step-up) around a handler, then wrap with the error handler. Returns a
 * route-handler-shaped function ready to export as POST.
 */
export function financeRoute(handler: FinanceHandler): (req: NextRequest) => Promise<Response> {
  return withErrorHandler(
    requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] })(
      requireStepUp(handler)
    ) as (req: NextRequest) => Promise<Response>
  );
}

/**
 * Pull the [id] payout segment out of /api/admin/finance/payouts/<id>/<action>.
 * Returns null when absent.
 */
export function payoutIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('payouts');
  if (idx === -1 || idx + 1 >= parts.length) return null;
  return decodeURIComponent(parts[idx + 1]) || null;
}

/** Read + JSON-parse the request body; returns the bad-request Response on failure. */
export async function readJsonBody(
  req: NextRequest
): Promise<{ ok: true; body: unknown } | { ok: false; res: Response }> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false, res: NextResponse.json({ error: 'INVALID' }, { status: 400 }) };
  }
}
