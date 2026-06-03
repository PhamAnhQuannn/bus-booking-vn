/**
 * Shared helpers for the /api/admin/charter/[id]/* dispatch action routes
 * (Issue 085): path-segment parse + CharterError → HTTP status mapping.
 *
 * Mirrors app/api/admin/operators/[id]/_shared.ts. Charter dispatch is role-gated
 * (SUPER_ADMIN | SUPPORT) + TOTP but does NOT require step-up — it is an ops action
 * routing a sales lead to an operator, not a money movement (no Hold / Booking /
 * Payout). See each route's requireAdminAuth call.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { CharterError } from '@/lib/charter';

/** Pull the [id] segment out of /api/admin/charter/<id>/<action>. */
export function charterIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean);
  // .../admin/charter/<id>/<action> → <id> is the segment after "charter".
  const idx = parts.indexOf('charter');
  if (idx === -1 || idx + 1 >= parts.length) return null;
  return decodeURIComponent(parts[idx + 1]) || null;
}

/**
 * Map the transition-service tagged error to its HTTP response:
 *   illegal_transition → 422, charter_not_found → 404.
 */
export function mapCharterError(e: CharterError): Response {
  if (e.code === 'illegal_transition') {
    return NextResponse.json({ error: 'ILLEGAL_TRANSITION' }, { status: 422 });
  }
  if (e.code === 'charter_not_found') {
    return NextResponse.json({ error: 'CHARTER_NOT_FOUND' }, { status: 404 });
  }
  // Exhaustive over CharterErrorCode; fall through is unreachable.
  return NextResponse.json({ error: 'INTERNAL' }, { status: 500 });
}
