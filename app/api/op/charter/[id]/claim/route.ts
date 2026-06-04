/**
 * POST /api/op/charter/[id]/claim — an APPROVED operator claims a PUBLISHED
 * public-pool charter lead (Issue 084, first-accept-wins).
 *
 * Gated: requireOperatorAuth + APPROVED (charter is an APPROVED-only capability —
 * Issue 046). There is NO ownership pre-check (unlike the 083 accept route) — the
 * pool is shared and the claimCharter atomic conditional UPDATE IS the guard: the
 * first commit wins, every other racer loses with rowcount 0.
 *
 *   200 { ok: true }                         — this operator won the claim
 *   409 { error: 'already_claimed' }         — another operator claimed it first,
 *                                              or the pool item expired (AC: losers
 *                                              get 409)
 *   404 { error: 'not_found' }               — no such charter request
 *   403 { error: 'NOT_APPROVED' }            — operator not APPROVED
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/core/db/client';
import { claimCharter } from '@/lib/charter/claimCharter';
import { assertOperatorApproved, CharterNotApprovedError } from '@/lib/charter/assertOperatorApproved';

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

      const result = await claimCharter(prisma, {
        charterId: id,
        operatorId: authCtx.operatorId,
      });

      if (result.ok) {
        return NextResponse.json({ ok: true });
      }
      if (result.reason === 'not_found') {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      // already_claimed → 409 (AC: the racing losers get 409).
      return NextResponse.json({ error: 'already_claimed' }, { status: 409 });
    })
  );

  return wrappedHandler(req);
}
