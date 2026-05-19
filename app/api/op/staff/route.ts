/**
 * /api/op/staff — operator staff collection routes (Issue 017).
 *
 * GET   list   — returns { staff: [...] } scoped to the caller's operator.
 * POST  create — body { name, phone }. Provisions a staff OperatorUser, SMSes a
 *                temp password, returns { staff } (201). 409 phone_in_use on
 *                phone collision.
 *
 * Both adminOnly — staff role cannot manage other staff (403 via HOF).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { listStaff } from '@/lib/staff/listStaff';
import { createStaff } from '@/lib/staff/createStaff';
import { StaffServiceError } from '@/lib/staff/errors';
import { CreateStaffSchema } from '@/lib/validation/staff';

async function getHandler(_req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  const staff = await listStaff(ctx.operatorId);
  return NextResponse.json({ staff });
}

async function postHandler(req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = CreateStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 });
  }

  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  const host = req.headers.get('host') ?? 'localhost:3000';
  const baseUrl = `${proto}://${host}`;

  try {
    const staff = await createStaff({
      operatorId: ctx.operatorId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      baseUrl,
    });
    return NextResponse.json({ staff }, { status: 201 });
  } catch (e) {
    if (e instanceof StaffServiceError && e.code === 'phone_in_use') {
      return NextResponse.json({ error: 'phone_in_use' }, { status: 409 });
    }
    throw e;
  }
}

export const GET = withErrorHandler(requireOperatorAuth({ adminOnly: true })(getHandler));
export const POST = withErrorHandler(requireOperatorAuth({ adminOnly: true })(postHandler));
