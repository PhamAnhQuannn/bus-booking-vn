/**
 * POST /api/op/bookings/cash — operator creates a walk-up cash booking (WT-13).
 *
 * I7-exempt: operator IS the price authority for cash-at-boarding bookings.
 * Price derives from Trip.price × ticketCount (not from request body).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { cashBookingSchema } from '@/lib/core/validation/cashBooking';
import {
  createCashBooking,
  CashBookingError,
} from '@/lib/booking';

export const POST = withErrorHandler(
  requireOperatorAuth({})(async (req: NextRequest, ctx: OperatorAuthContext) => {
    const body = await req.json();
    const parsed = cashBookingSchema.safeParse(body);

    if (!parsed.success) {
      // #566 (SEC-ZOD-LEAK): opaque error only — never echo zodError.issues (leaks schema shape).
      return NextResponse.json({ error: 'validation_failed' }, { status: 422 });
    }

    try {
      const booking = await createCashBooking({
        ...parsed.data,
        operatorId: ctx.operatorId,
      });

      return NextResponse.json({ booking }, { status: 201 });
    } catch (err) {
      if (err instanceof CashBookingError) {
        const statusMap: Record<string, number> = {
          trip_not_found: 404,
          trip_not_bookable: 422,
          insufficient_capacity: 422,
        };
        return NextResponse.json(
          { error: err.code },
          { status: statusMap[err.code] ?? 422 },
        );
      }
      throw err;
    }
  }),
);
