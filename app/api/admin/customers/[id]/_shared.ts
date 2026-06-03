/**
 * Shared helper for the /api/admin/customers/[id]/* moderation routes (Issue 066):
 * path-segment parse, mirroring operators/[id]/_shared.operatorIdFromUrl.
 */

import type { NextRequest } from 'next/server';

/** Pull the [id] segment out of /api/admin/customers/<id>/<action>. */
export function customerIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('customers');
  if (idx === -1 || idx + 1 >= parts.length) return null;
  return decodeURIComponent(parts[idx + 1]) || null;
}
