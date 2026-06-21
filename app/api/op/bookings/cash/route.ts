/**
 * POST /api/op/bookings/cash — operator creates a walk-up cash booking (WT-13).
 *
 * I7-exempt: operator IS the price authority for cash-at-boarding bookings.
 * Price derives from Trip.price × ticketCount (not from request body).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import {
  createCashBooking,
  CashBookingError,
} from '@/lib/booking';

const CashBookingSchema = z.object({
  tripId: z.string().min(1),
  buyerName: z.string().min(1).max(200),
  buyerPhone: z.string().min(1).max(20),
  buyerEmail: z.string().email().max(200).nullish(),
  ticketCount: z.number().int().min(1).max(50),
});

export const POST = withErrorHandler(
  requireOperatorAuth({})(async (req: NextRequest, ctx: OperatorAuthContext) => {
    const body = await req.json();
    const parsed = CashBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_failed', issues: parsed.error.issues },
        { status: 422 },
      );
    }

    try {
      const booking = await createCashBooking({
        ...parsed.data,
        buyerEmail: parsed.data.buyerEmail ?? null,
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
