/**
 * POST /api/account/password
 * Body: { currentPassword, newPassword }
 * Bearer auth required.
 * X-CSRF-Token required (double-submit — enforced by middleware).
 *
 * AC2 status map:
 *   200 ok — success
 *   422 CURRENT_PASSWORD_WRONG — currentPassword doesn't match
 *   422 PASSWORD_REUSED — newPassword equals current
 *   401 UNAUTHORIZED — missing/invalid Bearer token
 *   400 WEAK_PASSWORD — newPassword fails schema
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { requireCustomerAuth } from '@/lib/auth';
import { changePassword, ChangePasswordError } from '@/lib/account/changePassword';
import { z } from 'zod';
import { passwordSchema } from '@/lib/auth';

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

async function handler(req: NextRequest, { customerId }: { customerId: string }): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const newPwdErrors = parsed.error.issues.filter((i) => i.path.includes('newPassword'));
    if (newPwdErrors.length > 0) {
      return NextResponse.json({ error: 'WEAK_PASSWORD' }, { status: 400 });
    }
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  try {
    await changePassword(customerId, parsed.data.currentPassword, parsed.data.newPassword);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ChangePasswordError) {
      if (err.code === 'CURRENT_PASSWORD_WRONG') {
        return NextResponse.json({ error: 'CURRENT_PASSWORD_WRONG' }, { status: 422 });
      }
      if (err.code === 'PASSWORD_REUSED') {
        return NextResponse.json({ error: 'PASSWORD_REUSED' }, { status: 422 });
      }
      if (err.code === 'CUSTOMER_NOT_FOUND') {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }
    throw err;
  }
}

export const POST = withErrorHandler(requireCustomerAuth()(handler));
