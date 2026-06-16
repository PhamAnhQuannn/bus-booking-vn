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
import { getEnv } from '@/lib/core/config';
import type { Resend } from 'resend';

export type EmailTemplate =
  | 'customerBookingPaid'
  | 'operatorNewBooking'
  | 'bookingReminder24h'
  | 'payout_scheduled'
  | 'trip_cancelled'
  | 'operatorPending'
  // Issue 079: operator approval-state decision emails. Template names match the
  // 045 TEMPLATE_BY_TARGET map so the dispatcher renders a subject for each.
  | 'operatorApproved'
  | 'operatorRejected'
  | 'operatorSuspended'
  | 'operatorUnderReview'
  | 'operatorResubmit'
  // 2026-06-06: admin-provisioned operator login credentials (username + temp password).
  | 'operatorAccountCreated'
  // Issue 082: charter (thuê xe hợp đồng) lead-gen lifecycle emails.
  //   charterSubmitted — request received confirmation (sent at create time).
  //   charterMatched   — an operator accepted the lead (→ ACCEPTED, Issues 083/084).
  | 'charterSubmitted'
  | 'charterMatched'
  // Issue 084: public-pool first-accept-wins claim outcome emails to the operator.
  //   charterClaimWon  — this operator's claim won the pool item (→ ACCEPTED).
  //   charterClaimLost — (optional) another operator claimed it first.
  | 'charterClaimWon'
  | 'charterClaimLost'
  | 'ticketReady'
  | 'charterDeclined'
  // Issue 086: charter-expiry sweeper auto-return. When a direct-assign accept
  // deadline (acceptByAt) or a public-pool claim deadline (claimByAt) elapses
  // with no operator response, the cron returns the lead to ADMIN_REVIEW and
  // notifies the customer it is still being matched (no action needed from them).
  | 'charterReturnedToReview';

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
  // Issue 079: operator approval-state decision emails (both decision directions
  // + the under-review / resubmit states). Subjects kept minimal.
  operatorApproved: 'Tài khoản nhà xe đã được duyệt — go live',
  operatorRejected: 'Đơn đăng ký cần bổ sung',
  operatorSuspended: 'Tài khoản nhà xe đã bị tạm ngưng',
  operatorUnderReview: 'Hồ sơ nhà xe đang được xem xét',
  operatorResubmit: 'Đã nhận lại hồ sơ nhà xe',
  // 2026-06-06: operator account credentials.
  operatorAccountCreated: 'Tài khoản nhà xe của bạn đã sẵn sàng',
  // Issue 082: charter lead-gen lifecycle.
  charterSubmitted: 'BBVN — Đã nhận yêu cầu thuê xe',
  charterMatched: 'BBVN — Đã tìm được nhà xe cho yêu cầu của bạn',
  // Issue 084: public-pool claim outcome (operator-facing).
  charterClaimWon: 'BBVN — Bạn đã nhận được yêu cầu thuê xe',
  charterClaimLost: 'BBVN — Yêu cầu thuê xe đã được nhà xe khác nhận',
  // Issue 086: auto-return to admin review (no operator responded in time).
  charterReturnedToReview: 'BBVN — Chúng tôi vẫn đang tìm nhà xe cho bạn',
  ticketReady: 'BBVN — Vé điện tử của bạn đã sẵn sàng',
  charterDeclined: 'BBVN — Nhà xe đã từ chối yêu cầu thuê xe',
};

/** Resolve a subject line for the template; falls back to a generic subject. */
export function renderEmailSubject(template: string): string {
  return SUBJECTS[template] ?? 'BusBookVN';
}

function notifyStubbed(): boolean {
  return process.env.NOTIFY_STUB !== 'false';
}

// ---------------------------------------------------------------------------
// Resend adapter (lazy-loaded to avoid dep import in stub/dev mode)
// ---------------------------------------------------------------------------

let _resend: Resend | null = null;

export function _resetResendClient(): void { _resend = null; }

async function getResendClient(): Promise<Resend> {
  if (_resend) return _resend;
  const { Resend: ResendCls } = await import('resend');
  _resend = new ResendCls(getEnv().RESEND_API_KEY);
  return _resend;
}

async function sendViaResend(
  to: string,
  subject: string,
  body: string,
  template: string,
): Promise<SendEmailResult> {
  const from = process.env.EMAIL_FROM ?? 'noreply@busbookvn.com';
  try {
    const client = await getResendClient();
    const { data, error } = await client.emails.send({
      from,
      to,
      subject,
      text: body,
    });
    if (error) {
      logger.error({ template, err: error.message }, 'email.resend.api-error');
      return { ok: false, error: error.message };
    }
    logger.info({ template, externalRef: data?.id }, 'email.resend.sent');
    return { ok: true, externalRef: data?.id };
  } catch (err) {
    logger.error({ template, err }, 'email.resend.exception');
    return { ok: false, error: 'resend_exception' };
  }
}

// ---------------------------------------------------------------------------
// Public dispatch
// ---------------------------------------------------------------------------

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { to, template } = input;
  const subject = renderEmailSubject(template);
  const body =
    typeof input.payload === 'string'
      ? input.payload
      : JSON.stringify(input.payload);
  const bodyLen = body.length;

  if (notifyStubbed()) {
    const externalRef = `${STUB_PROVIDER_REF_PREFIX}${Date.now().toString(36)}`;
    logger.info(
      { template, externalRef, subjectLen: subject.length, bodyLen, recipientLen: to.length },
      'email.stub.dispatch',
    );
    return { ok: true, externalRef };
  }

  if (process.env.EMAIL_PROVIDER === 'resend') {
    return sendViaResend(to, subject, body, template);
  }

  logger.warn(
    { template, recipientLen: to.length },
    'email.real.not-wired — NOTIFY_STUB=false but no real email provider is configured',
  );
  return { ok: false, error: 'real_email_provider_not_wired' };
}
