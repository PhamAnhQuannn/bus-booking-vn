/**
 * requireCustomerAuth — HOF that guards customer-facing API routes (Issue 009).
 *
 * Customer access tokens are Bearer tokens held in client memory (returned in
 * the login/register response body, NOT a cookie — contrast operator auth which
 * uses the bb_op_access HttpOnly cookie). Routes therefore read the token from
 * the `Authorization: Bearer <token>` header.
 *
 * Usage (mirrors requireOperatorAuth — params captured via closure):
 *   export async function GET(req: NextRequest, ctx: RouteContext) {
 *     const { id } = await ctx.params;
 *     return withErrorHandler(
 *       requireCustomerAuth()(async (_req, authCtx) => {
 *         // authCtx.customerId is the verified Customer.id
 *       })
 *     )(req);
 *   }
 *
 * 401 UNAUTHORIZED when the header is missing/malformed or the token fails
 * verification (expired, tampered, or operator-scoped — verifyAccess rejects
 * scope='operator').
 *
 * ACTIVE-ACCOUNT GATE (Issue 066 + P4): a single DB lookup on the Customer row
 * after the token verifies, delegated to `checkCustomerActive`. A customer with
 * `suspendedAt !== null` (admin-suspended) → 403 ACCOUNT_SUSPENDED; a customer with
 * `deletedAt !== null` (soft-deleted) → 401 (indistinguishable from nonexistent).
 * Suspension/deletion also revoke all sessions (lib/admin/suspendCustomer.ts /
 * lib/account/anonymizeCustomer.ts) so the refresh path dies too; this gate is the
 * access-token backstop for any short-lived access JWT still in flight. A forged id
 * matches zero rows → 401.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/core/db/client';
import { verifyAccess } from './jwt';
import { checkCustomerActive } from './assertCustomerActive';

/** Context the HOF threads to the wrapped handler. */
export interface CustomerAuthContext {
  customerId: string;
}

type Handler = (req: NextRequest, ctx: CustomerAuthContext) => Promise<Response>;
type LegacyHandler = (req: NextRequest) => Promise<Response>;
type HOF = (handler: Handler) => LegacyHandler;

function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header);
  return match ? match[1] : null;
}

export function requireCustomerAuth(): HOF {
  return (handler: Handler): LegacyHandler => {
    return async (req: NextRequest): Promise<Response> => {
      const token = extractBearer(req.headers.get('authorization'));
      if (!token) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }

      const payload = await verifyAccess(token);
      if (!payload) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }

      // Active-account gate (Issue 066 + P4): re-read the Customer row to enforce
      // admin suspension AND soft-deletion on any access token still live at
      // suspend/delete time. A missing row (forged id) → 401; a deleted row → 401
      // (indistinguishable from nonexistent); a suspended row → 403 ACCOUNT_SUSPENDED.
      const customer = await prisma.customer.findUnique({
        where: { id: payload.sub },
        select: { id: true, suspendedAt: true, deletedAt: true },
      });
      if (!customer) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
      const status = checkCustomerActive(customer);
      if (!status.active) {
        if (status.reason === 'deleted') {
          return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        }
        return NextResponse.json({ error: 'ACCOUNT_SUSPENDED' }, { status: 403 });
      }

      return handler(req, { customerId: payload.sub });
    };
  };
}

/**
 * getCustomerOptional — non-throwing optional-auth read for routes that work
 * both signed-in and as guest (e.g. POST /api/bookings/initiate). Returns the
 * verified Customer.id from the `Authorization: Bearer` header, or null when
 * the header is absent/malformed or the token fails verification.
 *
 * Unlike requireCustomerAuth this never short-circuits the request — a missing
 * or invalid token simply means "treat as guest". Used to stamp Booking.customerId
 * at creation when the buyer is logged in (Issue 031), which both pre-fills the
 * account link and removes the phone-match attach spoof vector.
 *
 * Active-account gate (QA-H3): re-reads the Customer row and returns null (treat as
 * guest) for a suspended/soft-deleted customer, so a still-live access token can NOT
 * attribute a fresh booking to an account that was suspended or erased. Same
 * `checkCustomerActive` predicate as requireCustomerAuth — never throws.
 */
export async function getCustomerOptional(req: NextRequest): Promise<string | null> {
  const token = extractBearer(req.headers.get('authorization'));
  if (!token) return null;
  const payload = await verifyAccess(token);
  if (!payload) return null;
  const customer = await prisma.customer.findUnique({
    where: { id: payload.sub },
    select: { suspendedAt: true, deletedAt: true },
  });
  if (!customer || !checkCustomerActive(customer).active) return null;
  return payload.sub;
}
