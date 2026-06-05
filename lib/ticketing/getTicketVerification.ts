/**
 * Issue 072 — boarding verify read (token → LIVE booking view).
 *
 * getTicketVerification(token) is the source-of-truth read behind the PUBLIC
 * /verify/[token] boarding page. Flow:
 *
 *   1. verifyTicketToken(token) (Issue 071) — HS256 under the dedicated ticket
 *      key. Any tamper / wrong-key / malformed / wrong-scope → null. The token
 *      is a tamper-evident LOOKUP POINTER carrying only { ref, ct } — it never
 *      describes the passenger.
 *   2. LIVE in-process DB read keyed on the `ct` claim (== Booking.confirmationToken,
 *      192-bit, unique). NEVER self-fetches an API route (Mistake Log 2026-05-17,
 *      Issues 002/003) — the page + this lib call prisma directly.
 *   3. Defense-in-depth: the row's bookingRef MUST equal the token's `ref` claim.
 *      The token signs BOTH keys; a row whose ref disagrees with the signed ref
 *      means the token was minted for a different booking (or the row was
 *      re-keyed) — reject (null) rather than render a mismatched ticket.
 *
 * SOURCE OF TRUTH (AC3): bus plate, bus type, route, departureAt and operator
 * are read LIVE from the CURRENT Trip relation — so a bus reassignment or trip
 * edit after the QR was printed is reflected at boarding time. The token carries
 * none of these; they always come from the live row.
 *
 * NO PII (this is a PUBLIC, unauthenticated page): the returned view deliberately
 * OMITS buyerName / buyerPhone / buyerEmail. A boarding check needs only the
 * booking ref, the trip, the seat count, the PAID/UNPAID state, the provider txn
 * id (non-PII gateway reference, useful to reconcile a disputed payment), and the
 * live plate. The `select` below never reads the buyer columns, so they cannot
 * leak even by accident.
 */

import { prisma } from '@/lib/core/db/client';
import { verifyTicketToken } from '@/lib/ticketing/ticketToken';

/** Booking statuses that mean money has been received (paid or beyond). */
const PAID_STATUSES = new Set(['paid', 'completed']);

/**
 * The PUBLIC boarding view. Intentionally PII-free — no buyer name/phone/email.
 */
export interface TicketVerification {
  bookingRef: string;
  status: string;
  /** True once the booking has reached paid or beyond. */
  isPaid: boolean;
  ticketCount: number;
  /** Gateway provider transaction id (Booking.paymentExternalRef). Null pre-payment. */
  providerTxnId: string | null;
  operatorName: string;
  route: { origin: string; destination: string };
  /** ISO 8601; the page formats it in Asia/Ho_Chi_Minh. */
  departureAt: string;
  busPlate: string;
  busType: string;
  /**
   * Boarding check-in state (Issue 073). `checkedInAt` is the boarding timestamp
   * (ISO 8601) once the operator scanned + checked the passenger in; `noShowAt`
   * is set if they were marked no-show. Both null = not boarded yet. Timestamps
   * are non-PII (no name/phone) — safe on this PUBLIC page.
   */
  checkIn: {
    checkedInAt: string | null;
    noShowAt: string | null;
  };
}

/**
 * Resolve a signed ticket token to a LIVE, PII-free boarding view.
 * Returns null on: invalid/tampered token, booking-not-found, or ref/ct mismatch.
 */
export async function getTicketVerification(
  token: string,
): Promise<TicketVerification | null> {
  const claims = await verifyTicketToken(token);
  if (!claims) return null;

  // Live read keyed on the confirmationToken claim (unique-indexed).
  const booking = await prisma.booking.findUnique({
    where: { confirmationToken: claims.ct },
    select: {
      bookingRef: true,
      status: true,
      ticketCount: true,
      paymentExternalRef: true,
      // Issue 073: boarding state — timestamps only, no PII.
      checkedInAt: true,
      noShowAt: true,
      // NO buyerName / buyerPhone / buyerEmail — PUBLIC page, PII-free by design.
      trip: {
        select: {
          departureAt: true,
          route: { select: { origin: true, destination: true } },
          bus: {
            select: {
              licensePlate: true,
              busType: true,
              operator: { select: { legalName: true } },
            },
          },
        },
      },
    },
  });

  if (!booking) return null;

  // Defense: the signed ref claim must agree with the row. A disagreement means
  // the token points at a different booking than the row it resolved to.
  if (booking.bookingRef !== claims.ref) return null;

  return {
    bookingRef: booking.bookingRef,
    status: booking.status,
    isPaid: PAID_STATUSES.has(booking.status),
    ticketCount: booking.ticketCount,
    providerTxnId: booking.paymentExternalRef,
    operatorName: booking.trip.bus.operator.legalName,
    route: {
      origin: booking.trip.route.origin,
      destination: booking.trip.route.destination,
    },
    departureAt: booking.trip.departureAt.toISOString(),
    busPlate: booking.trip.bus.licensePlate,
    busType: booking.trip.bus.busType,
    checkIn: {
      checkedInAt: booking.checkedInAt ? booking.checkedInAt.toISOString() : null,
      noShowAt: booking.noShowAt ? booking.noShowAt.toISOString() : null,
    },
  };
}
