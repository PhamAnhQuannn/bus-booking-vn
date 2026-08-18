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
import { renderEmailBody } from '@/lib/notification/emailBody';
import type { Resend } from 'resend';

export type EmailTemplate =
  | 'otpCode'
  | 'customerBookingPaid'
  // Bug B: unmatched bank-transfer lifecycle (email is the customer channel).
  | 'customerBookingExpired'
  | 'customerPaymentReview'
  | 'customerPaymentUnverified'
  | 'opsUnmatchedPayment'
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
  /**
   * Optional idempotency token. Forwarded to Resend as the `Idempotency-Key`
   * header so a redelivery of the same NotificationLog row (a cron re-run after
   * a crash between send and the status='sent' write) does not send a duplicate.
   * The dispatcher passes the NotificationLog row id, mirroring the eSMS
   * `requestId` on the SMS channel. Ignored by the stub path.
   */
  idempotencyKey?: string;
}

export interface SendEmailResult {
  ok: boolean;
  externalRef?: string;
  error?: string;
  /**
   * How a failure failed — present only when `ok` is false (#368).
   *
   * `rejected` — the vendor answered and refused. The email was definitively NOT sent,
   *   so the next attempt must use a FRESH idempotency key: Resend replays a reused key
   *   for 24h and would hand back this same cached failure forever (that is why #335
   *   salts the key with attemptCount at all).
   * `unknown` — no answer: timeout, socket reset, thrown client error. Resend may or may
   *   not have accepted the message. Reusing the key here is what makes the retry safe;
   *   a fresh key would send a SECOND real email.
   *
   * The distinction already existed as two branches in sendViaResend and was flattened
   * into a bare `ok:false`, which silently chose "duplicate" for every unknown outcome.
   */
  outcome?: 'rejected' | 'unknown';
}

const STUB_PROVIDER_REF_PREFIX = 'stub_email_';

/**
 * Minimal subject map. The body is whatever the dispatcher already rendered
 * (NotificationLog.payload) — we do not re-render here, mirroring how the
 * dispatcher hands sendSms a pre-rendered string-ish payload.
 */
const SUBJECTS: Record<string, string> = {
  otpCode: 'BusBookVN — Mã xác thực OTP',
  customerBookingPaid: 'BusBookVN — Xac nhan thanh toan',
  customerBookingExpired: 'BusBookVN — Dat cho da het han',
  customerPaymentReview: 'BusBookVN — Dang doi chieu thanh toan',
  customerPaymentUnverified: 'BusBookVN — Can ho tro thanh toan',
  opsUnmatchedPayment: 'BBVN OPS — Chuyen khoan chua khop',
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
  ticketReady: 'BBVN — Biên nhận & vé điện tử của bạn đã sẵn sàng',
  charterDeclined: 'BBVN — Nhà xe đã từ chối yêu cầu thuê xe',
};

/** Resolve a subject line for the template; falls back to a generic subject. */
export function renderEmailSubject(template: string): string {
  return SUBJECTS[template] ?? 'BusBookVN';
}

/**
 * Email sending is gated on EMAIL_PROVIDER alone, NOT on NOTIFY_STUB. NOTIFY_STUB
 * governs SMS (eSMS) — coupling email to it would force eSMS credentials at boot
 * just to send email (env.ts superRefine). Keeping them independent lets email go
 * live (EMAIL_PROVIDER=resend + RESEND_API_KEY) while SMS stays stubbed.
 */
function emailStubbed(): boolean {
  // Read process.env directly (like the former notifyStubbed) rather than getEnv():
  // the stub gate must not trigger full-schema validation, which throws in bare
  // unit contexts. The real send path below still goes through getEnv().
  return process.env.EMAIL_PROVIDER !== 'resend';
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

/**
 * #620: classify a Resend `{error}` response into the idempotency outcome.
 * The Resend SDK returns `{error}` (rather than throwing) for HTTP-level failures
 * including ambiguous 5xx/429 where the message may already be queued. Only a
 * definite 4xx validation refusal (invalid_to, missing fields…) is 'rejected'
 * (safe to re-key); 5xx / 429 / unrecognised-transient are 'unknown' (hold the
 * key so the retry dedupes instead of sending a second real email).
 */
export function classifyResendError(error: {
  name?: string;
  statusCode?: number | null;
  message?: string;
}): 'rejected' | 'unknown' {
  const status = typeof error.statusCode === 'number' ? error.statusCode : undefined;
  if (status !== undefined) {
    return status >= 500 || status === 429 ? 'unknown' : 'rejected';
  }
  // No status code on the error — fall back to the Resend error `name`.
  const name = (error.name ?? '').toLowerCase();
  if (
    name.includes('rate_limit') ||
    name.includes('internal_server') ||
    name.includes('service_unavailable') ||
    name.includes('application_error')
  ) {
    return 'unknown';
  }
  // Unrecognised shape with no transient signal → treat as a 4xx-style refusal,
  // preserving pre-#620 behaviour for genuine validation errors.
  return 'rejected';
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  text: string,
  template: string,
  from: string,
  idempotencyKey?: string,
): Promise<SendEmailResult> {
  try {
    const client = await getResendClient();
    const { data, error } = await client.emails.send(
      {
        from,
        to,
        subject,
        html,
        text,
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );
    if (error) {
      // #620: only a DEFINITE 4xx validation refusal is 'rejected' (safe to re-key).
      // A 5xx / 429 / transient error is AMBIGUOUS — Resend may have accepted the
      // message — so it must be 'unknown' (hold the salt → the retry reuses the key
      // → Resend dedupes) exactly like a thrown timeout. On the inline hot path a
      // single Resend 5xx would otherwise duplicate-email every booking.
      const outcome = classifyResendError(error);
      logger.error({ template, err: error.message, outcome }, 'email.resend.api-error');
      return { ok: false, error: error.message, outcome };
    }
    logger.info({ template, externalRef: data?.id }, 'email.resend.sent');
    return { ok: true, externalRef: data?.id };
  } catch (err) {
    // No answer — timeout, socket reset, thrown client error. Resend may already have
    // accepted the message, so this must NOT be re-keyed: reusing the key lets Resend
    // dedupe the retry, whereas a fresh key sends a second real email to a customer.
    logger.error({ template, err }, 'email.resend.exception');
    return { ok: false, error: 'resend_exception', outcome: 'unknown' };
  }
}

// ---------------------------------------------------------------------------
// Public dispatch
// ---------------------------------------------------------------------------

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { to, template, idempotencyKey } = input;
  const subject = renderEmailSubject(template);
  // Render a branded HTML body + plain-text fallback from the stored payload
  // (SMS line, or a structured JSON blob for templates like `ticketReady`).
  const { html, text } = renderEmailBody(template, input.payload, subject);
  // Per-template sender: the payment RECEIPT (ticketReady) comes from a dedicated
  // "biên lai" address; everything else keeps the default noreply@ sender.
  const from = fromForTemplate(template);

  if (emailStubbed()) {
    const externalRef = `${STUB_PROVIDER_REF_PREFIX}${Date.now().toString(36)}`;
    logger.info(
      { template, from, externalRef, subjectLen: subject.length, bodyLen: text.length, recipientLen: to.length },
      'email.stub.dispatch',
    );
    return { ok: true, externalRef };
  }

  // EMAIL_PROVIDER === 'resend' (env guarantees RESEND_API_KEY via superRefine).
  return sendViaResend(to, subject, html, text, template, from, idempotencyKey);
}

/** Resolve the sender address for a template — receipt gets its own, else default. */
function fromForTemplate(template: string): string {
  const env = getEnv();
  if (template === 'ticketReady') return env.EMAIL_FROM_RECEIPT ?? env.EMAIL_FROM;
  return env.EMAIL_FROM ?? 'noreply@lenxevn.com';
}
