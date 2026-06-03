/**
 * Shared helpers for the /api/admin/moderation/* action routes (Issue 069, Part E).
 *
 *   idFromUrl(req, segment) — pull the [id] segment that follows <segment> out of
 *                             req.nextUrl.pathname (mirrors operators _shared.ts).
 *   moderationRoute(handler) — compose the admin auth chain for moderation routes:
 *                             withErrorHandler ∘ requireAdminAuth({ requireTotp,
 *                             role: ['SUPER_ADMIN','SUPPORT'] }). NO requireStepUp —
 *                             moderation is a lower-privilege action than the
 *                             suspend/fee-override surfaces (per AC). The actor each
 *                             handler records is `admin:<ctx.adminId>`.
 *   readReason(req) — tolerant body parse → { reason? }. Empty/absent/invalid body
 *                     yields {} so reason is optional.
 *   prismaErrorToStatus — Prisma P2025 (record not found) → 404, else rethrow.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth/requireAdminAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';

/** Pull the [id] segment immediately after <segment> from the request path. */
export function idFromUrl(req: NextRequest, segment: string): string | null {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf(segment);
  if (idx === -1 || idx + 1 >= parts.length) return null;
  return decodeURIComponent(parts[idx + 1]) || null;
}

type ModerationHandler = (req: NextRequest, ctx: AdminAuthContext) => Promise<Response>;

/**
 * Compose the moderation route chain. NOTE: explicitly NO requireStepUp — moderation
 * (disable/enable/resolve) is lower-priv than operator suspend / fee-override.
 */
export function moderationRoute(handler: ModerationHandler): (req: NextRequest) => Promise<Response> {
  return withErrorHandler(
    requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'SUPPORT'] })(handler) as (
      req: NextRequest
    ) => Promise<Response>
  );
}

const reasonSchema = z.object({ reason: z.string().min(1).optional() });

/** Tolerant body read → { reason? }. Empty/absent/invalid body → {}. */
export async function readReason(req: NextRequest): Promise<{ reason?: string }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {};
  }
  const parsed = reasonSchema.safeParse(body);
  return parsed.success ? parsed.data : {};
}

/** Map a thrown Prisma error to an HTTP response: P2025 (not found) → 404; else rethrow. */
export function prismaErrorToStatus(e: unknown): Response {
  if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2025') {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  throw e;
}

export { NextResponse };
export type { NextRequest, AdminAuthContext };
