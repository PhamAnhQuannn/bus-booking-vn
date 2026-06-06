/**
 * eSMS.vn HTTP client — the real SMS provider behind the NOTIFY_STUB seam.
 *
 * POSTs to {ESMS_BASE_URL}/MainService.svc/json/SendMultipleMessage_V4_post_json/
 * with the account creds + message. Maps CodeResult "100" (request accepted by
 * eSMS) → ok with SMSID as externalRef; any other code, or a network/timeout
 * error → ok:false with a short error string for NotificationLog.lastError.
 *
 * NEVER throws — mirrors the sendSms/sendSmsBody contract so eSMS downtime can
 * only ever touch a NotificationLog row, never booking state (Issue 058 AC5).
 *
 * Logs only non-sensitive fields (codeResult, smsType, externalRef) — never the
 * message Content (may contain the OTP code) or the recipient Phone (PII).
 */

import { getEnv } from '@/lib/config';
import { logger } from '@/lib/logger';
import type { SendSmsResult } from './esms';

const SEND_PATH = '/MainService.svc/json/SendMultipleMessage_V4_post_json/';
const TIMEOUT_MS = 10_000;

/** Convert a stored E.164 (+84xxxxxxxxx) phone to the eSMS-accepted 84xxxxxxxxx form. */
export function toEsmsPhone(e164: string): string {
  return e164.startsWith('+') ? e164.slice(1) : e164;
}

interface EsmsResponse {
  CodeResult?: string;
  SMSID?: string;
  ErrorMessage?: string;
}

export async function postEsms(input: {
  phone: string;
  content: string;
  smsType: string;
  requestId: string;
}): Promise<SendSmsResult> {
  const env = getEnv();

  const body = {
    ApiKey: env.ESMS_API_KEY,
    SecretKey: env.ESMS_SECRET_KEY,
    Brandname: env.ESMS_BRANDNAME,
    Phone: toEsmsPhone(input.phone),
    Content: input.content,
    SmsType: input.smsType,
    IsUnicode: '0', // bodies are ASCII (renderTemplate emits no diacritics)
    RequestId: input.requestId.slice(0, 50), // eSMS idempotency key, max 50 chars / 24h
    Sandbox: env.ESMS_SANDBOX ? '1' : '0',
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${env.ESMS_BASE_URL}${SEND_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as EsmsResponse | null;
    const code = json?.CodeResult;

    if (code === '100') {
      logger.info(
        { codeResult: code, externalRef: json?.SMSID, smsType: input.smsType },
        'sms.esms.sent'
      );
      return { ok: true, externalRef: json?.SMSID };
    }

    logger.warn({ codeResult: code ?? null, smsType: input.smsType }, 'sms.esms.rejected');
    return {
      ok: false,
      error: `esms_code_${code ?? 'none'}${json?.ErrorMessage ? `:${json.ErrorMessage}` : ''}`,
    };
  } catch (err) {
    const error =
      err instanceof Error && err.name === 'AbortError'
        ? 'esms_timeout'
        : err instanceof Error
          ? err.message
          : String(err);
    logger.warn({ smsType: input.smsType }, 'sms.esms.error');
    return { ok: false, error };
  } finally {
    clearTimeout(timer);
  }
}
