// payment domain public API barrel (SYS20 rule 3).

export { getMomoAdapter } from './adapters/momo';
export { buildStubIpn, createStubAdapter, refundPaymentStub } from './adapters/stub';
export type { StubOutcome } from './adapters/stub';
export type { PaymentGateway, CreatePaymentInput } from './gateway';
export { processPaymentWebhook } from './processWebhook';
export { applyPaidStatusTransition, appendBookingPaidLedger } from './applyPaidTransition';
export { refundPayment } from './refund';
export { getGatewayFor } from './select';
export type { OnlinePaymentMethod } from './select';
