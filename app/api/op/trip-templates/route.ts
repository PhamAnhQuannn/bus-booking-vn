/**
 * /api/op/trip-templates — recurring template collection routes (Issue 013 AC5).
 *
 * GET  — list templates for operator
 * POST — create recurring template
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { createTemplate, listTemplates } from '@/lib/trips/generateFromTemplate';
import { CreateRecurringTemplateSchema } from '@/lib/core/validation/trip';

async function getHandler(_req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  const templates = await listTemplates(ctx.operatorId);
  return NextResponse.json({ templates });
}

async function postHandler(req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = CreateRecurringTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed', issues: parsed.error.issues }, { status: 422 });
  }

  const template = await createTemplate(ctx.operatorId, parsed.data);
  return NextResponse.json({ template }, { status: 201 });
}

export const GET = withErrorHandler(requireOperatorAuth({})(getHandler));
export const POST = withErrorHandler(requireOperatorAuth({})(postHandler));
