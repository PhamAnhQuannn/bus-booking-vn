/**
 * Email adapter — provider-agnostic transactional-email dispatch surface.
 *
 * Currently a console-log stub mirroring lib/notifications/esms.ts. Real email
 * provider (SES/Postmark/eSMS-email) HTTP integration lands in a follow-up;
 * the adapter shape is kept stable so the dispatcher can wire the contract now.
 *
 * sendEmail() returns { ok, externalRef? } — caller (the dispatcher) persists
 * the result to NotificationLog. Like sendSms, it never throws: a provider
 * failure surfaces as ok:false so a delivery failure only touches
 * NotificationLog (status=failed) and never the booking it references (AC5).
 *
 * Under NOTIFY_STUB (or always, while the real provider is deferred) it
 * deterministically succeeds and logs with NO network I/O.
 */

import { logger } from '@/lib/logger';

export type EmailTemplate =
  | 'customerBookingPaid'
  | 'operatorNewBooking'
  | 'bookingReminder24h'
  | 'payout_scheduled'
  | 'trip_cancelled'
  | 'operatorPending';

export interface SendEmailInput {
  to: string;
  template: EmailTemplate | string;
  /**
   * Pre-rendered body string OR a structured payload. The dispatcher stores the
   * already-rendered body in NotificationLog.payload, so the common path passes
   * a string; a structured payload is accepted for direct callers.
   */
  payload: string | Record<string, string | number>;
}

export interface SendEmailResult {
  ok: boolean;
  externalRef?: string;
  error?: string;
}

const STUB_PROVIDER_REF_PREFIX = 'stub_email_';

/**
 * Minimal subject map. The body is whatever the dispatcher already rendered
 * (NotificationLog.payload) — we do not re-render here, mirroring how the
 * dispatcher hands sendSms a pre-rendered string-ish payload.
 */
const SUBJECTS: Record<string, string> = {
  customerBookingPaid: 'BusBookVN — Xac nhan thanh toan',
  operatorNewBooking: 'BusBookVN — Khach dat ve moi',
  bookingReminder24h: 'BusBookVN — Nhac nho chuyen di',
  payout_scheduled: 'BusBookVN — Lich chi tra',
  trip_cancelled: 'BusBookVN — Chuyen di bi huy',
  operatorPending: 'BusBookVN — Ho so dang ky dang duoc xem xet',
};

/** Resolve a subject line for the template; falls back to a generic subject. */
export function renderEmailSubject(template: string): string {
  return SUBJECTS[template] ?? 'BusBookVN';
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { to, template } = input;
  const subject = renderEmailSubject(template);
  const bodyLen =
    typeof input.payload === 'string'
      ? input.payload.length
      : JSON.stringify(input.payload).length;

  // Deterministic stub ref. No network I/O — real provider deferred.
  const externalRef = `${STUB_PROVIDER_REF_PREFIX}${Date.now().toString(36)}`;

  logger.info(
    { template, externalRef, subjectLen: subject.length, bodyLen, recipientLen: to.length },
    'email.stub.dispatch'
  );

  return { ok: true, externalRef };
}
