/**
 * GET /api/bookings/:id/ticket — ticket-PDF download for an authenticated
 * customer (Issue 009, PRD story 17; async-generate rewrite Issue 074).
 *
 * Same strict ownership scoping as the detail route (locked decision Q3): the
 * booking is fetched by BOTH id AND customerId, so a non-owned or missing id is
 * an indistinguishable 404. No confirmationToken path here.
 *
 * Status gate: a ticket only represents a booking that actually secured a seat
 * and was not cancelled. awaiting_payment / payment_failed_expired never held a
 * confirmed seat; cancelled / trip_cancelled are void. Those return 409.
 *
 * Issue 074 — NO byte-proxy + NO in-request render. The PDF is generated
 * asynchronously by the generate-ticket-pdfs cron (renders + uploads to object
 * storage, stamps Booking.ticketPdfKey). This route only:
 *   - ticketPdfKey NULL → 202 { status:'pending' } (the cron will produce it).
 *   - ticketPdfKey present → mint a FRESH short-lived signed download URL and
 *     302-redirect to it. Re-download mints a new URL each call (no re-render);
 *     the bytes never touch the app server.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireCustomerAuth, type CustomerAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { getCustomerBookingDetail } from '@/lib/booking';
import { prisma } from '@/lib/core/db/client';
import { createSignedDownloadUrl } from '@/lib/storage';
import type { BookingPaymentStatus } from '@/lib/booking';
import { logger } from '@/lib/logger';

const TICKETABLE_STATUSES: ReadonlySet<BookingPaymentStatus> = new Set([
  'paid',
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

      // Read the storage key (ownership already enforced above by the scoped
      // getCustomerBookingDetail; this id is the owned booking).
      const keyed = await prisma.booking.findUnique({
        where: { id },
        select: { ticketPdfKey: true },
      });
      const key = keyed?.ticketPdfKey ?? null;

      if (!key) {
        // The async cron hasn't generated it yet — tell the client to retry.
        return NextResponse.json(
          { status: 'pending', message: 'Ticket is being generated' },
          { status: 202 }
        );
      }

      try {
        // Fresh signed URL per request — no re-render, bytes never proxied.
        const { downloadUrl } = await createSignedDownloadUrl(prisma, key, {
          actor: `customer:${ctx.customerId}`,
        });
        return NextResponse.redirect(downloadUrl, 302);
      } catch (err) {
        logger.error(
          { bookingId: id, err: (err as Error).message },
          'ticket_pdf_signed_url_failed'
        );
        return NextResponse.json({ error: 'ticket_url_failed' }, { status: 500 });
      }
    })
  )(req);
}
