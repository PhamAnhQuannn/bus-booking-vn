/**
 * POST /api/op/charter/[id]/accept — operator accepts a directly-assigned charter
 * lead (Issue 083, AC2).
 *
 * Gated: requireOperatorAuth + APPROVED (charter is an APPROVED-only capability —
 * Issue 046). Ownership: the charter's assigneeOperatorId MUST equal the caller's
 * operatorId, else 404 (no cross-operator existence leak).
 *
 * Drives ASSIGNED_DIRECT → ACCEPTED via transitionCharterRequest — the Issue 082
 * ACCEPTED side-effect enqueues the customer "match" notification automatically.
 * actor = `operator:<operatorId>`.
 *
 *   200 { ok: true }
 *   403 NOT_APPROVED (operator not APPROVED)
 *   404 not_found (no such charter, OR assigned to a different operator)
 *   422 ILLEGAL_TRANSITION (not in ASSIGNED_DIRECT)
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/core/db/client';
import { transitionCharterRequest } from '@/lib/charter';
import { CharterError } from '@/lib/charter';
import { assertOperatorApproved, CharterNotApprovedError } from '@/lib/charter';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (_request: NextRequest, authCtx: OperatorAuthContext) => {
      // APPROVED gate (charter is APPROVED-only — Issue 046).
      try {
        await assertOperatorApproved(prisma, authCtx.operatorId);
      } catch (e) {
        if (e instanceof CharterNotApprovedError) {
          return NextResponse.json({ error: 'NOT_APPROVED' }, { status: 403 });
        }
        throw e;
      }

      // Issue 030 B-10: ownership check moved INSIDE transitionCharterRequest's
      // FOR UPDATE lock via requiredAssigneeOperatorId — closes the TOCTOU gap.
      try {
        await transitionCharterRequest(prisma, {
          charterId: id,
          to: 'ACCEPTED',
          actor: `operator:${authCtx.operatorId}`,
          requiredAssigneeOperatorId: authCtx.operatorId,
        });
        return NextResponse.json({ ok: true });
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
