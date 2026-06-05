/**
 * DELETE /api/account
 * Bearer auth required. Idempotent soft-delete.
 *
 * AC5 status map:
 *   200 { ok: true, alreadyDeleted } — always on success (idempotent)
 *   401 UNAUTHORIZED
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { requireCustomerAuth } from '@/lib/auth';
import { deleteAccount } from '@/lib/account';

async function handler(req: NextRequest, { customerId }: { customerId: string }): Promise<Response> {
  const result = await deleteAccount(customerId);
  return NextResponse.json({ ok: true, alreadyDeleted: result.alreadyDeleted });
}

export const DELETE = withErrorHandler(requireCustomerAuth()(handler));
