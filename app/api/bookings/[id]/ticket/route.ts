/**
 * GET /api/bookings/:id/ticket — PDF ticket download for an authenticated
 * customer (Issue 009, PRD story 17).
 *
 * Same strict ownership scoping as the detail route (locked decision Q3): the
 * booking is fetched by BOTH id AND customerId, so a non-owned or missing id is
 * an indistinguishable 404. No confirmationToken path here.
 *
 * Status gate: a ticket only represents a booking that actually secured a seat
 * and was not cancelled. awaiting_payment / payment_failed_expired never held a
 * confirmed seat; cancelled / trip_cancelled are void. Those return 409.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireCustomerAuth, type CustomerAuthContext } from '@/lib/auth/requireCustomerAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { getCustomerBookingDetail } from '@/lib/booking/getCustomerBookingDetail';
import { renderTicketPdf } from '@/lib/booking/ticketPdf';
import type { BookingPaymentStatus } from '@/lib/booking/bookingDto';
import { logger } from '@/lib/logger';

const TICKETABLE_STATUSES: ReadonlySet<BookingPaymentStatus> = new Set([
  'pending_cash_payment',
  'paid_operator_notified',
  'completed',
  'no_show',
]);

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, routeCtx: RouteContext): Promise<Response> {
  const { id } = await routeCtx.params;

  return withErrorHandler(
    requireCustomerAuth()(async (_req: NextRequest, ctx: CustomerAuthContext) => {
      const booking = await getCustomerBookingDetail(ctx.customerId, id);
      if (!booking) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (!TICKETABLE_STATUSES.has(booking.status)) {
        return NextResponse.json({ error: 'not_ticketable' }, { status: 409 });
      }

      try {
        const pdf = await renderTicketPdf(booking);
        return new NextResponse(new Uint8Array(pdf), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="ticket-${booking.bookingRef}.pdf"`,
            'Cache-Control': 'no-store',
          },
        });
      } catch (err) {
        logger.error({ bookingId: id, err: (err as Error).message }, 'ticket_pdf_render_failed');
        return NextResponse.json({ error: 'ticket_render_failed' }, { status: 500 });
      }
    })
  )(req);
}
