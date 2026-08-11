/**
 * PSP payment-confirmation window (minutes) — Issue 100.
 *
 * A booking in awaiting_payment created within this window still occupies its seat in
 * the capacity check (the PSP / bank transfer may yet confirm and seat the passenger).
 * After the window elapses the awaiting_payment booking no longer blocks capacity, and
 * the reconcile sweeper may expire it. Must exceed HOLD_TTL_MINUTES so there is no gap
 * between hold expiry and awaiting_payment capacity protection.
 *
 * Kept in this PURE leaf module (no prisma / DB-client import) so that:
 *   - client components (the bank-transfer countdown) can read it without pulling a
 *     server-only module into the browser bundle, and
 *   - no-DB job/unit contexts (reconcilePayments) can import it without instantiating
 *     the Prisma client at module eval.
 * `lib/core/db/holdRepo` re-exports it for existing importers.
 */
export const PSP_WINDOW_MINUTES = 20;
