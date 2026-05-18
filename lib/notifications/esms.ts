/**
 * eSMS adapter — provider-agnostic SMS dispatch surface.
 *
 * Currently a console-log stub. Real eSMS HTTP integration lands in a follow-up.
 * Adapter shape kept stable so the booking flow can wire the contract now.
 *
 * sendSms() returns { ok, externalRef? } — caller persists the result to
 * NotificationLog. We never throw from this function; failure → ok:false so
 * the booking transaction is unaffected by SMS provider downtime.
 */

import { logger } from '@/lib/logger';

export type SmsTemplate = 'bookingPendingCash' | 'operatorNewBooking';

export interface SendSmsInput {
  to: string;
  template: SmsTemplate;
  payload: Record<string, string | number>;
}

export interface SendSmsResult {
  ok: boolean;
  externalRef?: string;
  error?: string;
}

const STUB_PROVIDER_REF_PREFIX = 'stub_';

export function renderTemplate(template: SmsTemplate, payload: Record<string, string | number>): string {
  switch (template) {
    case 'bookingPendingCash':
      return (
        `BusBookVN: dat cho ${payload.ticketCount} ve, chuyen ${payload.route} ` +
        `${payload.departureAt}. Tra tien mat khi len xe. Ma: ${payload.bookingRef}. ` +
        `Xac nhan: ${payload.confirmationUrl}`
      );
    case 'operatorNewBooking':
      return (
        `BusBookVN: ${payload.ticketCount} khach moi, chuyen ${payload.route} ` +
        `${payload.departureAt}. SDT: ${payload.buyerPhone}. Ma: ${payload.bookingRef}.`
      );
    default: {
      const exhaustive: never = template;
      throw new Error(`unknown template: ${String(exhaustive)}`);
    }
  }
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const { to, template, payload } = input;
  const body = renderTemplate(template, payload);
  const externalRef = `${STUB_PROVIDER_REF_PREFIX}${Date.now().toString(36)}`;

  logger.info(
    { template, externalRef, bodyLen: body.length, recipientLen: to.length },
    'sms.stub.dispatch'
  );

  return { ok: true, externalRef };
}
