/**
 * GET /api/admin/operators/[id]/kyb/[docId]/url (Issue 077)
 *
 * SUPER_ADMIN + TOTP-verified. Mints a fresh, short-lived signed GET URL for one
 * operator KYB document so the admin can view it. createSignedDownloadUrl audits
 * the kyb_doc access (PII purpose) — every view is recorded in the AdminAuditLog
 * (AC2/AC4). The admin never sees the storage key directly and the URL expires.
 *
 * Belongs-to check: the docId must reference a KybDocument whose operatorId equals
 * the [id] segment — prevents an admin pasting another operator's docId under a
 * different operator's path (404 NOT_FOUND on any mismatch / missing doc).
 *
 * Response: 200 { url } (the client opens it in a new tab). 404 if the doc does
 * not exist or does not belong to the operator.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/core/db/client';
import { createSignedDownloadUrl } from '@/lib/storage';

/** Parse /api/admin/operators/<id>/kyb/<docId>/url → { operatorId, docId }. */
function parsePath(req: NextRequest): { operatorId: string; docId: string } | null {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean);
  const opIdx = parts.indexOf('operators');
  const kybIdx = parts.indexOf('kyb');
  if (opIdx === -1 || kybIdx === -1 || kybIdx + 1 >= parts.length) return null;
  const operatorId = decodeURIComponent(parts[opIdx + 1] ?? '');
  const docId = decodeURIComponent(parts[kybIdx + 1] ?? '');
  if (!operatorId || !docId) return null;
  return { operatorId, docId };
}

async function getHandler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const parsed = parsePath(req);
  if (!parsed) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const doc = await prisma.kybDocument.findUnique({
    where: { id: parsed.docId },
    select: { operatorId: true, storageKey: true },
  });

  // Belongs-to check: missing doc OR a doc owned by a different operator → 404
  // (do not distinguish the two — don't leak whether the docId exists elsewhere).
  if (!doc || doc.operatorId !== parsed.operatorId) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  // Mints a fresh signed GET URL AND writes the PII-access audit row (kyb_doc).
  const { downloadUrl } = await createSignedDownloadUrl(prisma, doc.storageKey, {
    actor: `admin:${ctx.adminId}`,
  });

  return NextResponse.json({ url: downloadUrl });
}

export const GET = withErrorHandler(
  requireAdminAuth({ requireTotp: true, role: 'SUPER_ADMIN' })(getHandler) as (
    req: NextRequest
  ) => Promise<Response>
);
