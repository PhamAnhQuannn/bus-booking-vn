/**
 * /api/op/pickup-areas — operator pickup-area menu collection (Issue 105).
 *
 * GET  list the authenticated operator's pickup areas (active + inactive).
 * POST create a new area from a GSO code triple (server resolves names/label).
 *
 * Status codes:
 *   200 list · 201 create · 400 bad_request (malformed JSON) ·
 *   422 invalid_input (zod) | invalid_area | duplicate_area · 401 unauthorized.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import {
  listOperatorPickupAreas,
  createOperatorPickupArea,
  PickupAreaServiceError,
} from '@/lib/catalog';
import { operatorPickupAreaCreateSchema } from '@/lib/core/validation/pickupArea';

async function getHandler(_req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  const areas = await listOperatorPickupAreas({ operatorId: ctx.operatorId });
  return NextResponse.json({ areas });
}

async function postHandler(req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const parsed = operatorPickupAreaCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const area = await createOperatorPickupArea({ operatorId: ctx.operatorId, data: parsed.data });
    return NextResponse.json({ area }, { status: 201 });
  } catch (e) {
    if (e instanceof PickupAreaServiceError) {
      return NextResponse.json({ error: e.code }, { status: 422 });
    }
    throw e;
  }
}

export const GET = withErrorHandler(requireOperatorAuth({})(getHandler));
export const POST = withErrorHandler(requireOperatorAuth({})(postHandler));
