/**
 * attachGuestBooking — placeholder for the future "remember this booking on
 * this device" wiring (Issue 009: guest booking history).
 *
 * In the cash flow we already write Booking to the DB; this hook would also
 * persist the bookingId into the guest cookie / localStorage handoff so the
 * customer's "My bookings" list shows it without an account.
 *
 * For Issue 003 it intentionally does nothing — the orchestrator calls it
 * so the integration point exists, but no client-side state is mutated yet.
 */
export async function attachGuestBooking(bookingId: string): Promise<void> {
  void bookingId;
}
