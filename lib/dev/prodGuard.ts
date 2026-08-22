/**
 * Shared production guard for every `app/dev/**` surface (SEC-DEV-STUB-PROD-SAFETY, #559).
 *
 * `app/dev/*` routes are built into the prod bundle and `proxy.ts` does not block them, so each
 * dev-only surface MUST refuse in production on its OWN — independent of any `*_STUB` flag (a flag
 * left at its insecure default must not be the only thing standing between prod and a dev tool).
 * Previously only `stub-pay` had this guard; `stub-storage` did not. One helper, three shapes:
 *   - route handlers  → `devRouteProdGuard()` returns a 404 Response (or null to proceed)
 *   - server actions  → `assertDevActionAllowed()` throws
 *   - pages/RSC       → `assertDevPageAllowed()` calls notFound()
 */

import { NextResponse } from 'next/server';
import { notFound } from 'next/navigation';
import { isRealProduction } from '@/lib/core/config/deployTier';

/**
 * True on a REAL Vercel production deployment. Evaluated per-call so tests can flip the env.
 * #643: keys off VERCEL_ENV (not raw NODE_ENV) so `app/dev/*` surfaces (stub-pay, stub-storage)
 * stay reachable on PREVIEW deployments — needed to verify the booking→payment→ticket flow on a
 * preview URL — while still hard-404'ing on real production. Preview is SSO-gated + uses its own
 * throwaway DB, and no webhook route verifies a stub signature, so this does not arm a prod risk.
 */
function isProd(): boolean {
  return isRealProduction();
}

/** Route handlers: `const blocked = devRouteProdGuard(); if (blocked) return blocked;` */
export function devRouteProdGuard(): NextResponse | null {
  if (!isProd()) return null;
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

/** Server actions: call at the top; throws on a production deployment. */
export function assertDevActionAllowed(): void {
  if (isProd()) {
    throw new Error('dev-only: not available on a production deployment');
  }
}

/** Pages / RSC: call at the top; renders 404 on a production deployment. */
export function assertDevPageAllowed(): void {
  if (isProd()) notFound();
}
