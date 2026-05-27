/**
 * PATCH /api/account/name
 * Body: { displayName }
 * Bearer auth required.
 *
 * AC4 status map:
 *   200 { displayName } — success
 *   422 DISPLAY_NAME_TOO_SHORT | DISPLAY_NAME_TOO_LONG — validation failure
 *   400 INVALID — malformed body
 *   401 UNAUTHORIZED
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { requireCustomerAuth } from '@/lib/auth/requireCustomerAuth';
import { updateName, UpdateNameError } from '@/lib/account/updateName';
import { z } from 'zod';

const schema = z.object({
  displayName: z.string(),
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
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  try {
    const result = await updateName(customerId, parsed.data.displayName);
    return NextResponse.json({ displayName: result.displayName });
  } catch (err) {
    if (err instanceof UpdateNameError) {
      return NextResponse.json({ error: err.code }, { status: 422 });
    }
    throw err;
  }
}

export const PATCH = withErrorHandler(requireCustomerAuth()(handler));
