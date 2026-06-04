/**
 * POST /api/admin/moderation/reports/[id]/resolve (Issue 069, Part E).
 *
 * Marks an OPEN ContentReport resolved (status='resolved', resolvedBy/resolvedAt).
 * SUPER_ADMIN + SUPPORT, TOTP verified, NO step-up. No body. P2025 → 404.
 */

export const runtime = 'nodejs';

import { prisma } from '@/lib/core/db/client';
import { resolveReport } from '@/lib/admin';
import {
  idFromUrl,
  moderationRoute,
  prismaErrorToStatus,
  NextResponse,
  type NextRequest,
  type AdminAuthContext,
} from '../../../_shared';

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const reportId = idFromUrl(req, 'reports');
  if (!reportId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }
  try {
    await resolveReport(prisma, { reportId, actor: `admin:${ctx.adminId}` });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return prismaErrorToStatus(e);
  }
}

export const POST = moderationRoute(handler);
