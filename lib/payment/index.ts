// payment domain public API barrel (SYS20 rule 3).

export { getMomoAdapter } from './adapters/momo';
export { getVnpayAdapter } from './adapters/vnpay';
export { getBankTransferAdapter, recoverSepayEvent } from './adapters/bankTransfer';
export { buildStubIpn, createStubAdapter, refundPaymentStub } from './adapters/stub';
export type { StubOutcome } from './adapters/stub';
export type { PaymentGateway, CreatePaymentInput } from './gateway';
export { processPaymentWebhook, recordUnmatchedPaymentEvent } from './processWebhook';
export { applyPaidStatusTransition, appendBookingPaidLedger } from './applyPaidTransition';
export { refundPayment } from './refund';
export { getGatewayFor } from './select';
export type { OnlinePaymentMethod } from './select';
