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
 *   a normalized CanonicalPaymentEvent on success. Each adapter maps its
 *   own native IPN field names + result codes into this single canonical
 *   shape — native gateway field names never leak past the adapter boundary.
 *   Callers never access raw IPN fields without first calling this.
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
  /** Client IP address for gateway logging / fraud detection. */
  clientIp?: string;
  /** Absolute IPN/webhook URL for gateways that accept it at payment-creation time. */
  webhookUrl?: string;
}

export type CreatePaymentResult =
  | { ok: true; payUrl: string; externalRef: string }
  | { ok: false; error: string };

export type CanonicalPaymentStatus = 'paid' | 'failed' | 'pending' | 'unknown';

export interface CanonicalPaymentEvent {
  /** Our booking reference (gateway orderId). */
  orderRef: string;
  /** Gateway transaction id — the one pinned dedup key everywhere. */
  providerTxnId: string;
  /** Amount in VND minor units (integer). */
  amount: number;
  /** ISO-4217 currency. VND by construction. */
  currency: string;
  /** Normalized status; adapter maps its native result code into this. */
  status: CanonicalPaymentStatus;
}

export type VerifyWebhookResult =
  | { ok: true; event: CanonicalPaymentEvent }
  | { ok: false; reason: string };

export interface PaymentGateway {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyWebhook(rawBody: string): VerifyWebhookResult;
}
