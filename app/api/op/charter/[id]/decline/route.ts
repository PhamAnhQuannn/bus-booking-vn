/**
 * POST /api/op/charter/[id]/decline — operator declines a directly-assigned
 * charter lead (Issue 083, AC2). Body: { reason?: string }.
 *
 * Gated: requireOperatorAuth + APPROVED. Ownership: the charter's
 * assigneeOperatorId MUST equal the caller's operatorId, else 404.
 *
 * Drives ASSIGNED_DIRECT → DECLINED → ADMIN_REVIEW via declineCharter (DECLINED is
 * transient — the lead re-enters the admin queue for reassignment; the DECLINED
 * side-effect clears assigneeOperatorId per Issue 081). actor = `operator:<id>`.
 *
 *   200 { ok: true, to: 'ADMIN_REVIEW' }
 *   403 NOT_APPROVED
 *   404 not_found
 *   422 ILLEGAL_TRANSITION (not in ASSIGNED_DIRECT)
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/core/db/client';
import { declineCharter } from '@/lib/charter';
import { CharterError } from '@/lib/charter';
import { assertOperatorApproved, CharterNotApprovedError } from '@/lib/charter';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (request: NextRequest, authCtx: OperatorAuthContext) => {
      // APPROVED gate (charter is APPROVED-only — Issue 046).
      try {
        await assertOperatorApproved(prisma, authCtx.operatorId);
      } catch (e) {
        if (e instanceof CharterNotApprovedError) {
          return NextResponse.json({ error: 'NOT_APPROVED' }, { status: 403 });
        }
        throw e;
      }

      // Optional reason — tolerate an empty / missing body.
      let reason: string | undefined;
      try {
        const body = (await request.json()) as { reason?: unknown } | null;
        if (body && typeof body.reason === 'string') {
          reason = body.reason;
        }
      } catch {
        // no body → no reason; fine.
      }

      // Ownership check: only the assigned operator may act (else 404).
      const charter = await prisma.charterRequest.findUnique({
        where: { id },
        select: { assigneeOperatorId: true },
      });
      if (!charter || charter.assigneeOperatorId !== authCtx.operatorId) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }

      try {
        const result = await declineCharter(prisma, {
          charterId: id,
          actor: `operator:${authCtx.operatorId}`,
          reason,
        });
        return NextResponse.json({ ok: true, to: result.to });
      } catch (e) {
        if (e instanceof CharterError) {
          if (e.code === 'charter_not_found') {
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
          }
          if (e.code === 'illegal_transition') {
            return NextResponse.json({ error: 'ILLEGAL_TRANSITION' }, { status: 422 });
          }
        }
        throw e;
      }
    })
  );

  return wrappedHandler(req);
}
