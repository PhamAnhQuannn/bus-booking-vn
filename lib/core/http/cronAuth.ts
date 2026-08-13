/**
 * Shared cron authentication (SEC-CRON-AUTH, #562).
 *
 * Vercel Cron invokes each `app/api/cron/*` route with `Authorization: Bearer <CRON_SECRET>`.
 * Previously all 13 routes inlined a plain `authHeader !== \`Bearer ${secret}\`` string compare —
 * NOT constant-time, and copy-pasted, so a 14th route could silently omit the check. This is the
 * single choke point: constant-time compare via `crypto.timingSafeEqual`, fail-closed when the
 * secret is unset. Matches the SePay webhook's timingSafeEqual discipline.
 */

import crypto from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Returns a 401 Response when the request is not an authentic cron invocation, or `null` to
 * proceed. Usage: `const unauthorized = assertCronAuth(req); if (unauthorized) return unauthorized;`
 */
export function assertCronAuth(req: { headers: { get(name: string): string | null } }): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get('authorization') ?? '';
  const expected = secret ? `Bearer ${secret}` : '';

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // Fail closed if the secret is unset; length check before timingSafeEqual (it throws on
  // unequal lengths, and an early length reject leaks only that — not the secret's content).
  const ok = !!secret && a.length === b.length && crypto.timingSafeEqual(a, b);

  return ok ? null : NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
}
