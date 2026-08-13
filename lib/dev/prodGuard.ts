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

/** True on a production deployment. Evaluated per-call so tests can flip NODE_ENV. */
function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
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
