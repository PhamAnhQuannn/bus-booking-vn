/**
 * [SYS20] lib/core/id — identifier primitive.
 *
 * Holds ID / reference generation and the regexes that validate it. Imported BY
 * domains; imports NO domain.
 *
 * bookingRef moved here from lib/booking (#343). It was one mechanism of the
 * payment↔booking barrel cycle: lib/payment/adapters/bankTransfer reconstructs a
 * bookingRef from a bank memo and needs BOOKING_REF_REGEX, which forced a
 * cross-domain import back into lib/booking. The module is pure — crypto and Intl
 * only, no Prisma, no env — so lib/core is where it belonged, and this barrel's
 * original placeholder comment already earmarked it by name.
 *
 * The generator and its regex move TOGETHER, deliberately. Splitting them is how
 * they drift: the 2026-07-23 SePay incident was a rebuilt ref whose case did not
 * match what generateBookingRef had stored, and 100% of bank transfers silently
 * no-op'd behind 33 green tests. Anything validating a booking ref must be able to
 * round-trip a real generated one from the same module.
 */

export { generateBookingRef, BOOKING_REF_REGEX } from './bookingRef';
