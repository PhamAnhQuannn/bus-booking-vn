/**
 * /api/op/payout-account (Issue 078)
 *
 * POST — the authenticated operator registers/updates the single bank account the
 * platform sends payouts to. Editing the account RESETS verification (the operator
 * must re-verify ownership before the payout rail will send — see
 * lib/onboarding/payoutAccount.ts).
 *
 * GET — returns the operator's account with accountNumber MASKED to last 4 (or 404
 * when none is registered).
 *
 * Auth: requireOperatorAuth — the tenant is ALWAYS the session operator
 * (ctx.operatorId). A body operatorId is ignored (cross-tenant write would be a
 * money exploit — the platform credits this number).
 *
 * accountNumber is sensitive PII: it is on the logger redact list, masked on the
 * GET path, and never echoed back in the POST response.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/core/db/client';
import { setPayoutAccount, getPayoutAccount } from '@/lib/onboarding/payoutAccount';

const PayoutAccountSchema = z.object({
  bankName: z.string().trim().min(1).max(120),
  accountNumber: z.string().trim().min(4).max(34),
  accountHolderName: z.string().trim().min(1).max(140),
  // operatorId intentionally NOT in the schema — the tenant is the session.
});

async function postHandler(req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = PayoutAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 422 }
    );
  }

  await setPayoutAccount(prisma, {
    operatorId: ctx.operatorId, // tenant = session, NEVER a body field
    bankName: parsed.data.bankName,
    accountNumber: parsed.data.accountNumber,
    accountHolderName: parsed.data.accountHolderName,
  });

  // Do NOT echo the account number back. Editing reset verification (caller
  // re-verifies before the payout rail will send).
  return NextResponse.json({ ok: true });
}

async function getHandler(_req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  const account = await getPayoutAccount(prisma, ctx.operatorId);
  if (!account) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ account });
}

export const POST = withErrorHandler(
  requireOperatorAuth({})(postHandler) as (req: NextRequest) => Promise<Response>
);

export const GET = withErrorHandler(
  requireOperatorAuth({})(getHandler) as (req: NextRequest) => Promise<Response>
);
