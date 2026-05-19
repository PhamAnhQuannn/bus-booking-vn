/**
 * /api/op/routes — operator route collection (Issue 012).
 *
 * GET  list all routes for the authenticated operator.
 * POST create a new route.
 *
 * Status codes (AC verbatim):
 *   201 on create; 200 on list.
 *   400 bad_request (malformed JSON) | invalid_input (zod).
 *   401 unauthorized.
 *   422 invalid_input (zod).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { listRoutes } from '@/lib/routes/listRoutes';
import { createRoute } from '@/lib/routes/createRoute';
import { routeCreateSchema } from '@/lib/validation/route';

async function getHandler(_req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  const routes = await listRoutes({ operatorId: ctx.operatorId });
  return NextResponse.json({ routes });
}

async function postHandler(req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const parsed = routeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 422 });
  }

  const route = await createRoute({ operatorId: ctx.operatorId, data: parsed.data });
  return NextResponse.json({ route }, { status: 201 });
}

export const GET = withErrorHandler(requireOperatorAuth({})(getHandler));
export const POST = withErrorHandler(requireOperatorAuth({})(postHandler));
