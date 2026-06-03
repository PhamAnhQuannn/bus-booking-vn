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

export type SmsTemplate =
  | 'bookingPendingCash'
  | 'operatorNewBooking'
  | 'customerBookingPaid'
  | 'otpCode'
  | 'manualBookingPaid'
  | 'manualBookingCash'
  | 'staffTempPassword'
  | 'operatorAdminTempPassword'
  | 'bookingReminder24h';

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
    case 'manualBookingPaid':
      return (
        `BusBookVN: Nha xe xac nhan ${payload.ticketCount} ve, chuyen ${payload.route} ` +
        `${payload.departureAt}. Da thanh toan. Ma dat cho: ${payload.bookingRef}. ` +
        `Ho tro: ${payload.operatorPhone}`
      );
    case 'manualBookingCash':
      return (
        `BusBookVN: Nha xe giu cho ${payload.ticketCount} ve, chuyen ${payload.route} ` +
        `${payload.departureAt}. Vui long tra tien mat khi len xe. Ma dat cho: ${payload.bookingRef}. ` +
        `Ho tro: ${payload.operatorPhone}`
      );
    case 'staffTempPassword':
      return (
        `BusBookVN: Tai khoan nhan vien da tao. SDT dang nhap: ${payload.phone}. ` +
        `Mat khau tam thoi: ${payload.tempPassword}. Dang nhap va doi mat khau: ${payload.loginUrl}`
      );
    case 'operatorAdminTempPassword':
      return (
        `BusBookVN: Tai khoan quan tri nha xe. SDT dang nhap: ${payload.phone}. ` +
        `Mat khau tam thoi: ${payload.tempPassword}. Dang nhap va doi mat khau: ${payload.loginUrl}`
      );
    case 'bookingReminder24h':
      return (
        `BusBookVN: Nhac nho chuyen ${payload.route} khoi hanh ${payload.departureAt} ` +
        `(con ~24h). ${payload.ticketCount} ve. Ma dat cho: ${payload.bookingRef}. ` +
        `Vui long co mat truoc gio khoi hanh.`
      );
    default: {
      const exhaustive: never = template;
      throw new Error(`unknown template: ${String(exhaustive)}`);
    }
  }
}

/**
 * Issue 058: send an ALREADY-RENDERED SMS body (no template re-render).
 *
 * The notification dispatcher stores the rendered body string in
 * NotificationLog.payload at enqueue time, then re-presents it here at delivery
 * time. Re-rendering from a structured payload at dispatch is impossible — the
 * dispatcher only has the stored string, and not every stored template (e.g.
 * 'payout_scheduled', 'trip_cancelled') is a member of the SmsTemplate union.
 *
 * Like sendSms, never throws: a provider failure surfaces as ok:false so a
 * delivery failure only ever touches NotificationLog, never the booking (AC5).
 */
export async function sendSmsBody(input: {
  to: string;
  template: string;
  body: string;
}): Promise<SendSmsResult> {
  const { to, template, body } = input;
  const externalRef = `${STUB_PROVIDER_REF_PREFIX}${Date.now().toString(36)}`;

  logger.info(
    { template, externalRef, bodyLen: body.length, recipientLen: to.length },
    'sms.stub.dispatch'
  );

  return { ok: true, externalRef };
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
