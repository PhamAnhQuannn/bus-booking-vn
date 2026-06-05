/**
 * POST /api/op/reports/payouts/[id]/retry
 *
 * Transitions a failed payout to 'processing' for re-attempt by the payment processor.
 * TOCTOU-safe via SELECT FOR UPDATE in retryPayout service.
 *
 * Responses:
 *   200 { payout }               — successfully queued for retry.
 *   404 { error: 'not_found' }   — payout does not exist OR belongs to another operator
 *                                  (existence-hiding for cross-tenant IDOR per Issue 011/013).
 *   409 { error: 'not_failed' }  — payout is not in 'failed' state; cannot retry.
 *
 * // I7-exempt: operator-only mutation, no client-originated amount.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { retryPayout } from '@/lib/ledger';
import { withErrorHandler } from '@/lib/withErrorHandler';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, routeCtx: RouteContext): Promise<Response> {
  // withErrorHandler scrubs any unexpected throw (e.g. a retryPayout DB failure) into a
  // generic 500 — domain errors are still mapped to 404/409 inside.
  const wrapped = withErrorHandler(async () => {
    const { id: payoutId } = await routeCtx.params;

    const handler = requireOperatorAuth({})(async (_req: NextRequest, authCtx: OperatorAuthContext) => {
      const result = await retryPayout({ payoutId, operatorId: authCtx.operatorId });

      if (result.ok) {
        return NextResponse.json({ payout: result.payout });
      }

      switch (result.error) {
        case 'not_found':
        case 'wrong_operator':
          // Existence-hiding: both cases return 404 to avoid leaking cross-tenant payout existence.
          return NextResponse.json({ error: 'not_found' }, { status: 404 });
        case 'not_failed':
          return NextResponse.json({ error: 'not_failed' }, { status: 409 });
        default: {
          // Exhaustiveness guard — tsc errors here if a new error variant is added without handling it
          result.error satisfies never;
          return NextResponse.json({ error: 'internal_error' }, { status: 500 });
        }
      }
    });

    return handler(req);
  });

  return wrapped(req);
}
