/**
 * POST /api/op/money/withdraw — on-demand operator withdrawal (Issue 053).
 *
 * Creates a (requested) non-trip-scoped Payout draining the authenticated
 * operator's available balance, which then flows through the SAME sweep state
 * machine as auto-payouts (requested → processing → paid|failed).
 *
 * Auth: requireOperatorAuth — the tenant is ALWAYS the authenticated operator
 * (ctx.operatorId). A body `operatorId` is IGNORED (never trust a client-supplied
 * tenant id — cross-tenant withdrawal would be a money exploit).
 *
 * Idempotency: prefer a client-supplied `Idempotency-Key` header for true
 * double-submit safety (a retried POST with the same key returns the same payout,
 * no second withdrawal). If absent we mint a server-side per-request uuid — this
 * still makes requestWithdrawal's internal writes idempotent within the request,
 * but does NOT dedup a genuine client double-submit (two POSTs → two keys → two
 * withdrawals, each gated independently by the available-balance check). Clients
 * SHOULD send the header.
 *
 * Responses:
 *   200 { payoutId }                       — withdrawal requested (or idempotent replay).
 *   422 { error: 'below_min' }             — amount below MIN_WITHDRAW_THRESHOLD_VND.
 *   422 { error: 'insufficient_available' }— available balance < amount.
 *   422 { error: 'invalid_amount' }        — non-positive / non-integer amount.
 *   422 { error: 'validation_failed' }     — body failed schema.
 *   400 { error: 'invalid_body' }          — body was not JSON.
 *
 * CSRF: handled by the existing proxy.ts middleware for all non-safe /api/* routes
 * (this path is not in any CSRF-exempt set), so a missing/invalid X-CSRF-Token is
 * rejected with 403 before this handler runs.
 *
 * I7-exempt: operator-side money op; the amount is the operator's OWN balance pull,
 * gated server-side against the derived available balance (not a client-priced sale).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { requestWithdrawal } from '@/lib/ledger';

const WithdrawSchema = z.object({
  amountMinor: z.number().int().positive(),
  // operatorId is intentionally NOT in the schema — the tenant is the session.
});

async function postHandler(req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = WithdrawSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 422 }
    );
  }

  // Prefer a client-supplied Idempotency-Key header; fall back to a server uuid.
  const idempotencyKey = req.headers.get('Idempotency-Key')?.trim() || randomUUID();

  const result = await requestWithdrawal({
    operatorId: ctx.operatorId, // tenant = session, NEVER a body field
    amountMinor: parsed.data.amountMinor,
    idempotencyKey,
  });

  if (result.ok) {
    return NextResponse.json({ payoutId: result.payoutId });
  }

  // below_min / insufficient_available / invalid_amount → 422 (validation-failure).
  return NextResponse.json({ error: result.reason }, { status: 422 });
}

export const POST = withErrorHandler(requireOperatorAuth({})(postHandler));
