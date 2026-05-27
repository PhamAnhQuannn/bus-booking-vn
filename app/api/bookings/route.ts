/**
 * GET /api/bookings?tab=upcoming|past — authenticated customer's bookings
 * history (Issue 009, PRD story 15).
 *
 * Auth required (Bearer access token). Scoped to the JWT sub (customerId);
 * a customer sees only their own attached bookings. Cursor-paginated.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireCustomerAuth, type CustomerAuthContext } from '@/lib/auth/requireCustomerAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import {
  listCustomerBookings,
  ListCustomerBookingsParamsSchema,
} from '@/lib/booking/listCustomerBookings';

export const GET = withErrorHandler(
  requireCustomerAuth()(async (req: NextRequest, ctx: CustomerAuthContext) => {
    const url = new URL(req.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());

    const parsed = ListCustomerBookingsParamsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_failed', issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const result = await listCustomerBookings(ctx.customerId, parsed.data);
    return NextResponse.json(result);
  })
);
