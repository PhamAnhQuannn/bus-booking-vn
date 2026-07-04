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

import { randomUUID } from 'node:crypto';
import { logger } from '@/lib/logger';
import { getEnv } from '@/lib/config';
import { postEsms } from './esmsClient';

export type SmsTemplate =
  | 'bookingPendingCash'
  | 'operatorNewBooking'
  | 'customerBookingPaid'
  | 'customerBookingExpired'
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

/**
 * Stub unless NOTIFY_STUB is explicitly "false". Read straight from process.env
 * (not getEnv()) so the no-network stub path never triggers a full env-schema
 * parse — unit tests run without HOLD_SECRET etc. The real branch calls getEnv()
 * itself, where the superRefine validates the ESMS_* credentials.
 */
function notifyStubbed(): boolean {
  return process.env.NOTIFY_STUB !== 'false';
}

// ---------------------------------------------------------------------------
// Test-only OTP sink — in-memory map keyed by recipient phone (E.164).
// Populated only when NODE_ENV !== 'production'. Never written to logs.
//
// globalThis singleton (same pattern as lib/core/db/client.ts): Next.js bundles
// each API route separately, so a plain module-level Map is duplicated per route
// bundle. Without this, an OTP written from /api/auth/forgot-password lands in a
// different Map instance than /api/auth/otp/test-peek reads, and the test sink
// appears empty for any flow whose send route differs from the peek route.
// ---------------------------------------------------------------------------
const globalForOtpSink = globalThis as unknown as { otpTestSink: Map<string, string> | undefined };
const _testOtpSink: Map<string, string> = globalForOtpSink.otpTestSink ?? new Map<string, string>();
globalForOtpSink.otpTestSink = _testOtpSink;

/** Return the last OTP code sent to a given key (phone or email) in this process. Test-only. */
export function getTestOtp(key: string): string | undefined {
  return _testOtpSink.get(key);
}

/** Stash an OTP code in the test sink (keyed by email/phone). Used by email OTP path. */
export function stashTestOtp(key: string, code: string): void {
  if (process.env.NODE_ENV !== 'production') {
    _testOtpSink.set(key, code);
  }
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
        `${payload.departureAt}. SDT: ${payload.buyerPhone}. Ma: ${payload.bookingRef}.` +
        // Issue 111: custom pickup request folded into the same SMS (no second message).
        (payload.customPickup ? ` Diem don rieng: ${payload.customPickup}. Goi xac nhan.` : '')
      );
    case 'customerBookingPaid':
      return (
        `BusBookVN: Thanh toan MoMo thanh cong. ${payload.ticketCount} ve, chuyen ` +
        `${payload.route} ${payload.departureAt}. Ma: ${payload.bookingRef}. ` +
        `Xac nhan: ${payload.confirmationUrl}`
      );
    case 'customerBookingExpired':
      // Issue 095: reconciliation sweeper expiry notice — the hold lapsed with no
      // confirmed payment, so the booking is released.
      return (
        `BusBookVN: Dat cho ${payload.bookingRef} (chuyen ${payload.route} ` +
        `${payload.departureAt}) da het han do chua thanh toan. Vui long dat lai neu can.`
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
 * No-network stub dispatch (NOTIFY_STUB=true). Logs the dispatch and, for OTP
 * codes in non-production, stashes the plain code in the test sink so e2e /
 * dev can read it via /api/auth/otp/test-peek. The code itself is never logged.
 */
function stubDispatch(
  to: string,
  template: string,
  body: string,
  otpCode?: string
): SendSmsResult {
  const externalRef = `${STUB_PROVIDER_REF_PREFIX}${Date.now().toString(36)}`;

  logger.info(
    { template, externalRef, bodyLen: body.length, recipientLen: to.length },
    'sms.stub.dispatch'
  );

  if (process.env.NODE_ENV !== 'production' && template === 'otpCode' && typeof otpCode === 'string') {
    _testOtpSink.set(to, otpCode);
  }

  return { ok: true, externalRef };
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
 * `requestId` (the NotificationLog row id) is forwarded to eSMS as the
 * idempotency key so a cron re-run can't double-send the same row.
 *
 * Like sendSms, never throws: a provider failure surfaces as ok:false so a
 * delivery failure only ever touches NotificationLog, never the booking (AC5).
 */
export async function sendSmsBody(input: {
  to: string;
  template: string;
  body: string;
  requestId?: string;
}): Promise<SendSmsResult> {
  const { to, template, body, requestId } = input;

  if (notifyStubbed()) {
    return stubDispatch(to, template, body);
  }

  // Real eSMS: booking/operator templates use the CSKH brandname type "2".
  return postEsms({
    phone: to,
    content: body,
    smsType: '2',
    requestId: requestId ?? randomUUID(),
  });
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const { to, template, payload } = input;
  const body = renderTemplate(template, payload);

  if (notifyStubbed()) {
    const otpCode = template === 'otpCode' && typeof payload.code === 'string' ? payload.code : undefined;
    return stubDispatch(to, template, body, otpCode);
  }

  // Real eSMS. OTP uses the configured OTP SmsType; everything else CSKH "2".
  // No booking row here (synchronous send), so a fresh UUID is the idempotency key.
  return postEsms({
    phone: to,
    content: body,
    smsType: template === 'otpCode' ? getEnv().ESMS_OTP_SMSTYPE : '2',
    requestId: randomUUID(),
  });
}
