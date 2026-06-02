/**
 * attachGuestBookingByPhone — link a guest booking to a registered Customer
 * by matching the booking's buyerPhone to a Customer.phone (Issue 009).
 *
 * Called inside the transaction that transitions a booking to
 * paid_operator_notified (MoMo webhook, cash collection, manual paid booking).
 * Idempotent: only claims a booking whose customerId IS NULL, so re-running a
 * transition (or a backfill scan) never re-points an already-attached row.
 *
 * Booking.buyerPhone is stored RAW (as the buyer typed it); Customer.phone is
 * stored E.164. We normalise buyerPhone before matching — a naive equality
 * join would miss every booking. A buyerPhone that fails normalisation simply
 * matches no customer and is skipped (no throw — the payment transition must
 * not fail because of an unparseable phone).
 *
 * SECURITY (Issue 031 — RESOLVED): buyerPhone is attacker-controllable, so a
 * phone-match attach is spoofable (a guest typing a victim's phone would link
 * the booking to that victim once they exist). The Issue 009 accept-for-MVP
 * stance has since been hardened: this function is NO LONGER called from any
 * payment transition (MoMo webhook, cash collection, manual booking). Ownership
 * now comes from exactly two proven sources — (1) a signed-in buyer whose
 * Customer.id is stamped on the Booking at initiate (see getCustomerOptional),
 * and (2) the OTP-proven register backfill below. This function is retained
 * only as the building block a future *OTP-gated* attach flow could reuse; do
 * not re-wire it into an unauthenticated transition.
 */

import type { Prisma } from '@prisma/client';
import { normalizePhone, PhoneNormalizeError } from '@/lib/auth/phoneNormalize';
import { logger } from '@/lib/logger';

export async function attachGuestBookingByPhone(
  tx: Prisma.TransactionClient,
  bookingId: string,
  buyerPhone: string
): Promise<void> {
  let normalized: string;
  try {
    normalized = normalizePhone(buyerPhone);
  } catch (err) {
    if (err instanceof PhoneNormalizeError) {
      // Unparseable buyer phone — no customer can match. Skip silently.
      return;
    }
    throw err;
  }

  const customer = await tx.customer.findFirst({
    where: { phone: normalized, deletedAt: null },
    select: { id: true },
  });
  if (!customer) return;

  // Idempotent claim: only attach when still unowned. A concurrent attach or a
  // re-run of the transition leaves an already-set customerId untouched.
  const result = await tx.booking.updateMany({
    where: { id: bookingId, customerId: null },
    data: { customerId: customer.id },
  });

  if (result.count > 0) {
    logger.info({ bookingId, customerId: customer.id }, 'booking.guest_attach.linked');
  }
}

/**
 * Raw buyerPhone forms that normalise to a given E.164 phone. Booking.buyerPhone
 * is stored as the buyer typed it, so a backfill keyed on E.164 must match every
 * accepted local/national form (see normalizePhone's accepted inputs).
 *   +84901234567  →  ['+84901234567', '84901234567', '0901234567']
 */
function rawPhoneVariants(e164: string): string[] {
  const rest = e164.slice(3); // strip '+84'
  return [e164, '84' + rest, '0' + rest];
}

/**
 * backfillGuestBookingsForCustomer — at register time, claim any pre-existing
 * guest bookings whose buyerPhone matches the new customer's phone (Issue 009
 * AC(a)). Idempotent + scoped to customerId IS NULL. See the security note on
 * attachGuestBookingByPhone — same accept-for-MVP trust model applies.
 */
export async function backfillGuestBookingsForCustomer(
  tx: Prisma.TransactionClient,
  customerId: string,
  e164Phone: string
): Promise<number> {
  const variants = rawPhoneVariants(e164Phone);
  const result = await tx.booking.updateMany({
    where: { buyerPhone: { in: variants }, customerId: null },
    data: { customerId },
  });
  if (result.count > 0) {
    logger.info(
      { customerId, count: result.count },
      'booking.guest_attach.backfilled'
    );
  }
  return result.count;
}
