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

export type SmsTemplate = 'bookingPendingCash' | 'operatorNewBooking' | 'customerBookingPaid' | 'otpCode';

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

// ---------------------------------------------------------------------------
// Test-only OTP sink — in-memory map keyed by recipient phone (E.164).
// Populated only when NODE_ENV !== 'production'. Never written to logs.
// ---------------------------------------------------------------------------
const _testOtpSink = new Map<string, string>();

/** Return the last OTP code sent to `phone` in this process. Test-only. */
export function getTestOtp(phone: string): string | undefined {
  return _testOtpSink.get(phone);
}

/** Clear the test OTP sink (call between tests to avoid cross-test pollution). */
export function clearTestOtpSink(): void {
  _testOtpSink.clear();
}

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
    case 'customerBookingPaid':
      return (
        `BusBookVN: Thanh toan MoMo thanh cong. ${payload.ticketCount} ve, chuyen ` +
        `${payload.route} ${payload.departureAt}. Ma: ${payload.bookingRef}. ` +
        `Xac nhan: ${payload.confirmationUrl}`
      );
    case 'otpCode':
      return `BusBookVN: Ma xac thuc cua ban la ${payload.code}. Het han sau ${payload.expiryMinutes} phut. Khong chia se ma nay.`;
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

  // Populate test sink for OTP codes in non-production environments only.
  // The plain code is stored in `payload.code`; never log it.
  if (process.env.NODE_ENV !== 'production' && template === 'otpCode' && typeof payload.code === 'string') {
    _testOtpSink.set(to, payload.code);
  }

  return { ok: true, externalRef };
}
