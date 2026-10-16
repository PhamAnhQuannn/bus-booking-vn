// payment domain public API barrel (SYS20 rule 3).

export { getMomoAdapter } from './adapters/momo';
export { getVnpayAdapter, recoverVnpayEvent } from './adapters/vnpay';
export { getBankTransferAdapter, recoverSepayEvent } from './adapters/bankTransfer';
export { buildStubIpn, createStubAdapter, refundPaymentStub } from './adapters/stub';
export type { StubOutcome } from './adapters/stub';
export type { PaymentGateway, CreatePaymentInput } from './gateway';
export { processPaymentWebhook, recordUnmatchedPaymentEvent, UNMATCHED_REASON, UNFULFILLED_REASON } from './processWebhook';
export { applyPaidStatusTransition, appendBookingPaidLedger } from './applyPaidTransition';
export { refundPayment } from './refund';
// #343: refundOut moved here from lib/ledger — it calls the PSP then writes its ledger
// entries, the same shape as appendBookingPaidLedger above. Owning it here is what
// removes the last ledger<->payment cycle.
export {
  refundOut,
  RefundOutError,
  MANUAL_REFUND_PENDING,
  type RefundOutInput,
  type RefundOutResult,
  type RefundReason,
} from './refundOut';
export {
  markManualRefundPaid,
  resolveUnfulfilledPayment,
  type MarkManualRefundPaidResult,
  type ResolveUnfulfilledPaymentResult,
} from './manualRefund';
export {
  linkOrphanPayment,
  resolveOrphanPayment,
  type LinkOrphanPaymentResult,
  type ResolveOrphanPaymentResult,
} from './orphanPayment';
export { getGatewayFor } from './select';
export { isVnpaySelectable } from './vnpaySelectable';
export type { OnlinePaymentMethod } from './select';
