/**
 * Booking-status transition guard — the SINGLE source of truth for legal
 * forward moves of the booking money/lifecycle state machine (issue 034).
 *
 * Before this module, forward updates were guarded only by incidental
 * `WHERE status = 'awaiting_payment'` literals scattered across the webhook
 * path. That works (a replayed pending can't regress a paid row) but there was
 * no named state-machine layer, so a new transition added later could silently
 * allow `paid → pending`. The payment webhook now derives its UPDATE predecessors
 * from `legalPredecessors(target)` — never from re-typed literals.
 *
 * SCOPE: this models the ONLINE-PAYMENT lifecycle the webhook governs.
 * `pending_cash_payment` is a dead legacy enum value (the cash creation +
 * collection paths were removed in Issue 039; the enum itself is dropped in
 * Phase B / Wave 7). It is intentionally NOT a forward edge here — keeping it
 * out means the webhook's derived WHERE stays exactly `awaiting_payment` and
 * never touches historical cash rows.
 *
 * NOTE: enum value `paid_operator_notified` is "paid" until the Wave-7 rename
 * (`paid_operator_notified → paid` split). Do not rename here.
 */

import type { BookingStatus } from '@prisma/client';

/**
 * Legal forward transitions. Every BookingStatus key is present (no silent
 * holes); terminal states map to an empty list. Adding a new transition means
 * editing THIS map — the only place the rule lives.
 */
export const LEGAL_BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  awaiting_payment: ['paid_operator_notified', 'payment_failed_expired'],
  // Dead legacy enum value (cash paths removed in Issue 039; enum dropped in
  // Phase B). No forward moves — historical rows are terminal here.
  pending_cash_payment: [],
  paid_operator_notified: ['completed', 'trip_cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  trip_cancelled: [],
  no_show: [],
  payment_failed_expired: [],
};

/** True when `from → to` is a declared legal forward transition. */
export function isLegalTransition(from: BookingStatus, to: BookingStatus): boolean {
  return LEGAL_BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * All states that may legally transition INTO `to`. The payment webhook builds
 * its `WHERE status IN (...)` guard from this, so a replay/older event whose
 * current row is not a legal predecessor matches zero rows (no regress).
 */
export function legalPredecessors(to: BookingStatus): BookingStatus[] {
  return (Object.keys(LEGAL_BOOKING_TRANSITIONS) as BookingStatus[]).filter((from) =>
    LEGAL_BOOKING_TRANSITIONS[from].includes(to)
  );
}
