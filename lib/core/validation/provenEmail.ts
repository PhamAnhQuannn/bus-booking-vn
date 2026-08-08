/**
 * ProvenEmail — a branded string signalling the caller has INDEPENDENTLY PROVEN
 * ownership of this email (a single-use OTP proof, or a verified IdP id_token
 * with email_verified=true).
 *
 * It exists to guard `backfillGuestBookingsByEmail` (P22 / #444): that function
 * reassigns every guest booking whose `buyerEmail` matches, so calling it with an
 * unverified, caller-supplied email would let anyone who merely KNOWS a victim's
 * email silently claim the victim's guest bookings (IDOR). Requiring a ProvenEmail
 * makes that misuse a compile error — a bare `string` no longer type-checks.
 *
 * Construct ONLY from a code path that has already verified ownership. Lives in
 * lib/core (the base layer) so both lib/auth (register) and lib/booking (backfill)
 * can depend on it without a cross-domain import cycle.
 */
export type ProvenEmail = string & { readonly __brand: 'ProvenEmail' };

/**
 * Brand an already-ownership-proven email. Normalises (trim + lowercase) so the
 * value matches the stored, lowercased `Customer.email` / `Booking.buyerEmail`.
 */
export function asProvenEmail(email: string): ProvenEmail {
  return email.trim().toLowerCase() as ProvenEmail;
}
