/**
 * /api/op/buses  — operator fleet collection routes (Issue 011).
 *
 * GET   list — { activeOnly?: '0' | '1' } query.
 *              Defaults to activeOnly=true. Returns { buses: [...] }.
 * POST  create — body { licensePlate, capacity, busType }.
 *              422 plate_in_use on (operatorId, licensePlate) uniqueness collision.
 *
 * Both gated by requireOperatorAuth (default: not allowed during password change).
 * Operator scope is taken from the JWT operatorId claim via the HOF context.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { listOperatorBuses } from '@/lib/catalog/listOperatorBuses';
import { createBus, BusServiceError } from '@/lib/catalog/createBus';
import { CreateBusSchema } from '@/lib/core/validation/bus';

async function getHandler(req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get('activeOnly') !== '0';
  const buses = await listOperatorBuses(ctx.operatorId, { activeOnly });
  return NextResponse.json({ buses });
}

async function postHandler(req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = CreateBusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const bus = await createBus({
      operatorId: ctx.operatorId,
      licensePlate: parsed.data.licensePlate,
      capacity: parsed.data.capacity,
      busType: parsed.data.busType,
    });
    return NextResponse.json({ bus }, { status: 201 });
  } catch (e) {
    if (e instanceof BusServiceError && e.code === 'plate_in_use') {
      return NextResponse.json({ error: 'plate_in_use' }, { status: 422 });
    }
    throw e;
  }
}

export const GET = withErrorHandler(requireOperatorAuth({})(getHandler));
export const POST = withErrorHandler(requireOperatorAuth({})(postHandler));
