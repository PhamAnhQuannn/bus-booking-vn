/**
 * generateTicketPdfs — generate-once ticket-PDF job (Issue 074).
 *
 * Sweeps PAID bookings that have no ticket PDF yet (`ticketPdfKey IS NULL`),
 * renders the ticket PDF (with the boarding QR) IN-PROCESS, uploads it to object
 * storage via putObject, stamps the key, then enqueues a 'ticketReady' email
 * NotificationLog row for the dispatcher to deliver.
 *
 * NO SELF-FETCH (Mistake-Log 002/003): the job renders + uploads in-process via
 * lib/storage.putObject — it never HTTP-PUTs to the dev stub-storage route. The
 * route would be the wrong origin under `next dev` port bumps and is the exact
 * self-fetch anti-pattern the Mistake Log forbids.
 *
 * Idempotency / generate-once: the claim query selects ONLY rows WHERE
 * ticketPdfKey IS NULL with `FOR UPDATE SKIP LOCKED`, and the key-stamp UPDATE is
 * guarded `WHERE ... AND "ticketPdfKey" IS NULL`. A re-run skips already-keyed
 * rows, so each booking is rendered + uploaded exactly once. The render+upload
 * happen OUTSIDE the claim transaction (so the lock isn't held across the
 * @react-pdf render); SKIP LOCKED + the NULL guard serialize concurrent ticks.
 *
 * Lazy prisma import (mirrors lib/jobs/generateTrips): lib/db/client throws at
 * module-eval when DATABASE_URL is unset, and the cron route's unit tests mock
 * runJob and never invoke this core — keeping the import dynamic keeps the route's
 * static import graph free of the DB client.
 */

import type { JobCore, JobOpts } from './types';
import type { CustomerBookingDetail } from '@/lib/booking/getCustomerBookingDetail';

/** How many un-keyed bookings to render+upload per cron tick. */
export const BATCH_SIZE = 25;

/**
 * Paid booking states that warrant a ticket. Mirrors the route's
 * TICKETABLE_STATUSES — a ticket only represents a booking that secured a seat
 * and was not cancelled.
 */
const PAID_STATUSES = [
  'pending_cash_payment',
  'paid_operator_notified',
  'completed',
  'no_show',
] as const;

interface ClaimedRow {
  id: string;
  bookingRef: string;
  confirmationToken: string;
  buyerEmail: string | null;
}

export const generateTicketPdfs: JobCore = async (_tx, opts?: JobOpts) => {
  const now = opts?.now ?? new Date();

  const { prisma } = await import('@/lib/db/client');
  const { Prisma } = await import('@prisma/client');
  const { renderTicketPdf } = await import('@/lib/booking/ticketPdf');
  const { putObject } = await import('@/lib/storage');
  const { createNotificationLog } = await import('@/lib/db/notificationLogRepo');

  // 1. Claim a batch of paid, un-keyed bookings (SKIP LOCKED so two concurrent
  //    ticks never grab the same row). The rows stay PAID; the stamp happens
  //    per-row after the render/upload commits.
  const claimed = await prisma.$transaction(async (tx) => {
    return tx.$queryRaw<ClaimedRow[]>(Prisma.sql`
      SELECT "id", "bookingRef", "confirmationToken", "buyerEmail"
      FROM "Booking"
      WHERE "ticketPdfKey" IS NULL
        AND "status" IN (${Prisma.join(
          PAID_STATUSES.map((s) => Prisma.sql`${s}::"BookingStatus"`)
        )})
      ORDER BY "createdAt" ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    `);
  });

  let generated = 0;

  for (const row of claimed) {
    // Re-read the full booking detail (trip/route/bus/operator) for the PDF.
    // customerId can be null for guest bookings, so read directly by id rather
    // than via the customer-scoped getCustomerBookingDetail. We reuse its select
    // shape (customerBookingDetailSelect) by loading the same fields below.
    const detail = await loadBookingDetail(prisma, row.id);
    if (!detail) continue; // raced away (deleted) — nothing to render

    const pdf = await renderTicketPdf(detail, row.confirmationToken);
    const key = `ticket_pdf/${row.bookingRef}.pdf`;
    await putObject(prisma, key, 'application/pdf', pdf);

    // 3. Stamp the key — guarded WHERE ticketPdfKey IS NULL so a concurrent
    //    stamp (belt-and-suspenders against the SKIP-LOCKED claim) is a no-op.
    const stamped = await prisma.booking.updateMany({
      where: { id: row.id, ticketPdfKey: null },
      data: { ticketPdfKey: key, ticketPdfGeneratedAt: now },
    });
    if (stamped.count === 0) continue; // already keyed by a racing tick

    generated += 1;

    // 4. Enqueue the 'ticketReady' email for the dispatcher (NOTIFY_STUB-gated).
    //    Skip when there's no buyerEmail — there is nowhere to deliver. The PDF
    //    is still generated + downloadable via the ticket route.
    if (row.buyerEmail) {
      const token = await mintToken(row.bookingRef, row.confirmationToken);
      await createNotificationLog({
        bookingId: row.id,
        channel: 'email',
        template: 'ticketReady',
        recipient: row.buyerEmail,
        payload: JSON.stringify({
          bookingRef: row.bookingRef,
          verifyUrl: `/verify/${token}`,
          ticketUrl: `/api/bookings/${row.id}/ticket`,
        }),
        status: 'pending',
      });
    }
  }

  return { rowsAffected: generated, status: 'success' };
};

/** Mint the public verify-page token for the email link (same token the QR carries). */
async function mintToken(bookingRef: string, confirmationToken: string): Promise<string> {
  const { mintTicketToken } = await import('@/lib/ticketing/ticketToken');
  return mintTicketToken({ bookingRef, confirmationToken });
}

/**
 * Load the booking detail for rendering. customerId may be null (guest booking),
 * so this reads by id without the customer scope. Returns the same
 * CustomerBookingDetail shape renderTicketPdf consumes.
 */
async function loadBookingDetail(
  prisma: (typeof import('@/lib/db/client'))['prisma'],
  bookingId: string
): Promise<CustomerBookingDetail | null> {
  const { customerBookingDetailSelect } = await import('@/lib/booking/getCustomerBookingDetail');
  const row = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: customerBookingDetailSelect,
  });
  if (!row) return null;
  return {
    id: row.id,
    bookingRef: row.bookingRef,
    buyerName: row.buyerName,
    buyerPhone: row.buyerPhone,
    ticketCount: row.ticketCount,
    totalVnd: row.totalVnd,
    paymentMethod: row.paymentMethod as CustomerBookingDetail['paymentMethod'],
    status: row.status as CustomerBookingDetail['status'],
    createdAt: row.createdAt.toISOString(),
    route: { origin: row.trip.route.origin, destination: row.trip.route.destination },
    departureAt: row.trip.departureAt.toISOString(),
    busLicensePlate: row.trip.bus.licensePlate,
    operator: {
      legalName: row.trip.bus.operator.legalName,
      contactPhone: row.trip.bus.operator.contactPhone,
    },
  };
}
