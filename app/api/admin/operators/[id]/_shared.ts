/**
 * Shared helpers for the /api/admin/operators/[id]/* approval action routes
 * (Issue 065): path-segment parse + OperatorStatusError → HTTP status mapping.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { OperatorStatusError } from '@/lib/onboarding';

/** Pull the [id] segment out of /api/admin/operators/<id>/<action>. */
export function operatorIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean);
  // .../admin/operators/<id>/<action> → <id> is the segment after "operators".
  const idx = parts.indexOf('operators');
  if (idx === -1 || idx + 1 >= parts.length) return null;
  return decodeURIComponent(parts[idx + 1]) || null;
}

/**
 * Map the transition-service tagged error to its HTTP response:
 *   illegal_transition → 422, operator_not_found → 404.
 */
export function mapOperatorStatusError(e: OperatorStatusError): Response {
  if (e.code === 'illegal_transition') {
    return NextResponse.json({ error: 'ILLEGAL_TRANSITION' }, { status: 422 });
  }
  if (e.code === 'operator_not_found') {
    return NextResponse.json({ error: 'OPERATOR_NOT_FOUND' }, { status: 404 });
  }
  // Exhaustive over OperatorStatusErrorCode; fall through is unreachable.
  return NextResponse.json({ error: 'INTERNAL' }, { status: 500 });
}
