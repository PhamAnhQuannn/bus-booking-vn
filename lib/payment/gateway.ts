/**
 * PaymentGateway — abstract interface for payment adapters.
 *
 * Current adapters: MoMo (lib/payment/momo.ts)
 * Planned adapters: zalopay, card
 *
 * createPayment(): builds the gateway payment URL and returns a payUrl +
 *   externalRef (the gateway's own order/transaction identifier).
 *
 * verifyWebhook(): verifies an inbound IPN/callback signature and returns
 *   the parsed payload on success. Callers never access raw IPN fields
 *   without first calling this.
 */

export interface CreatePaymentInput {
  /** Our booking reference — used as the gateway orderId. */
  orderId: string;
  /** Total amount in VND. */
  amount: number;
  /** Human-readable order description shown in the payment app. */
  orderInfo: string;
  /** Absolute URL MoMo calls after payment (IPN endpoint). */
  ipnUrl: string;
  /** Absolute URL to redirect the browser after payment. */
  redirectUrl: string;
  /** Unique request ID for idempotency (caller-provided). */
  requestId: string;
}

export type CreatePaymentResult =
  | { ok: true; payUrl: string; externalRef: string }
  | { ok: false; error: string };

export interface ParsedIpn {
  orderId: string;
  transId: string;
  resultCode: number;
  amount: number;
  message: string;
  partnerCode: string;
  requestId: string;
  orderInfo: string;
  orderType: string;
  payType: string;
  responseTime: number;
  extraData: string;
}

export type VerifyWebhookResult =
  | { ok: true; parsed: ParsedIpn }
  | { ok: false; reason: string };

export interface PaymentGateway {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyWebhook(rawBody: string): VerifyWebhookResult;
}
