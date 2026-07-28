// booking domain public API barrel (SYS20 rule 3).

export { backfillGuestBookingsForCustomer, backfillGuestBookingsByEmail } from './attachGuestBookingByPhone';
export { renderTicketPdf } from './ticketPdf';
export { customerBookingDetailSelect } from './getCustomerBookingDetail';
export { type BookingDto, type BookingPaymentStatus } from './bookingDto';
export { getBookingByConfirmationToken, getBookingByRef } from './bookingRepo';
// #343: bookingRef + the transition map moved to lib/core (see those barrels for why).
// Re-exported here so existing lib/booking and app/ consumers keep one import site;
// lib/payment now imports from lib/core DIRECTLY, which is what breaks the cycle —
// re-exporting does not recreate it, but importing this barrel FROM lib/payment would.
export { BOOKING_REF_REGEX, generateBookingRef } from '@/lib/core/id';
export { checkInBooking, markNoShow, scanTicket } from './checkIn';
export { CONSENT_VERSION, CONSENT_TEXT } from './consent';
export {
  validatePickupSelection,
  type PickupSelection,
  type PickupCheck,
} from './pickupSelection';
export { createCashBooking, CashBookingError, type CashBookingErrorCode } from './createCashBooking';
export { getBookingDetailPage } from './getBookingDetailPage';
export { getCustomerBookingDetail, type CustomerBookingDetail } from './getCustomerBookingDetail';
export { getHoldDetails } from './getHoldDetails';
export { getManifest, type ManifestRow } from './getManifest';
export { getOperatorBooking } from './getOperatorBooking';
export { getUnviewedPaidCount } from './getUnviewedPaidCount';
export { initiateOnlineBooking } from './initiateOnlineBooking';
export {
  listCustomerBookings,
  ListCustomerBookingsParamsSchema,
  type CustomerBookingRow,
} from './listCustomerBookings';
export { listOperatorBookings, ListOperatorBookingsParamsSchema } from './listOperatorBookings';
export { resolveBookingTripId } from './resolveBookingTripId';
export { type BookingQueueRow } from './toBookingQueueRow';
export { touchLastViewed } from './touchLastViewed';
export { legalPredecessors } from '@/lib/core/booking';
