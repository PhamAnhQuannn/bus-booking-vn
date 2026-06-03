/**
 * POST /api/admin/moderation/trips/[id]/enable (Issue 069, Part E).
 *
 * Admin-enables a previously-disabled trip (Trip.moderatedAt = null). SUPER_ADMIN +
 * SUPPORT, TOTP verified, NO step-up. Body: { reason? } (tolerated empty). P2025 → 404.
 */

export const runtime = 'nodejs';

import { prisma } from '@/lib/db/client';
import { setTripModeration } from '@/lib/admin/moderation';
import {
  idFromUrl,
  readReason,
  moderationRoute,
  prismaErrorToStatus,
  NextResponse,
  type NextRequest,
  type AdminAuthContext,
} from '../../../_shared';

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  const tripId = idFromUrl(req, 'trips');
  if (!tripId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }
  const { reason } = await readReason(req);
  try {
    await setTripModeration(prisma, {
      tripId,
      disabled: false,
      actor: `admin:${ctx.adminId}`,
      reason,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return prismaErrorToStatus(e);
  }
}

export const POST = moderationRoute(handler);
