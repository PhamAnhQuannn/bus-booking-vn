/**
 * GET /api/admin/system/audit/export (Issue 070) — download the AdminAuditLog as CSV.
 *
 * READ-ONLY. Requires an AUTHENTICATED + TOTP-verified SUPER_ADMIN | FINANCE
 * (requireAdminAuth) — same role set as the feature-flags / Finance reads. Because
 * it is a safe GET that mutates nothing, there is deliberately NO requireStepUp and
 * NO CSRF double-submit (CSRF protects non-safe methods only; step-up gates
 * mutations only — this exports already-visible audit rows).
 *
 * Reads a large page in-process via getAuditLog (NEVER self-fetch — Issue 002/003),
 * with an optional ?action= exact-filter mirroring the System tab Audit section.
 * Streams the rows back as text/csv with an attachment disposition + no-store so
 * the file is never cached. auditLogToCsv is pure (the timestamp is each row's own
 * ISO instant — no Date.now in this handler).
 */

export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/core/db/client';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { getAuditLog, auditLogToCsv } from '@/lib/admin/getAuditLog';

async function handler(req: NextRequest, _ctx: AdminAuthContext): Promise<Response> {
  const action = req.nextUrl.searchParams.get('action')?.trim() || undefined;

  const { items } = await getAuditLog({ limit: 1000, action }, prisma);
  const csv = auditLogToCsv(items);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="audit-log.csv"',
      'Cache-Control': 'no-store',
    },
  });
}

export const GET = withErrorHandler(
  requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] })(
    handler
  ) as (req: NextRequest) => Promise<Response>
);
