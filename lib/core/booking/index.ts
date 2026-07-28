/**
 * [SYS20] lib/core/booking — booking-lifecycle state machine primitive.
 *
 * The legal-forward-transition map and its guards. Imported BY domains; imports NO
 * domain (only the BookingStatus TYPE from @prisma/client).
 *
 * Moved here from lib/booking (#343). `legalPredecessors` is what
 * lib/payment/{processWebhook,applyPaidTransition} build their monotonic
 * `WHERE status IN (...)` guard from, and reaching for it across the domain
 * boundary was the other half of the payment↔booking barrel cycle.
 *
 * It sits in lib/core rather than staying in lib/booking because the rule is not
 * owned by the booking domain in practice — the payment domain enforces it on every
 * webhook, and the reconcile sweeper on every tick. A guard that three domains
 * depend on is a shared primitive; leaving it inside one of them is what made the
 * cycle look unavoidable.
 *
 * This is the SINGLE source of truth for the transition rule (issue 034). Adding a
 * transition means editing the map in transitions.ts and nothing else — never
 * re-typing status literals at a call site.
 */

export {
  LEGAL_BOOKING_TRANSITIONS,
  isLegalTransition,
  legalPredecessors,
} from './transitions';
