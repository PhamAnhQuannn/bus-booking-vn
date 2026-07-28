/**
 * Scrub contact addresses out of a vendor error string before it is displayed (#371).
 *
 * `NotificationLog.lastError` stores the provider's message verbatim, and Resend names
 * the address it failed on (see `lib/notification/email.ts`). The admin failure list
 * masks `recipient` via `maskRecipient` and then printed `lastError` raw one line below
 * — re-leaking the exact value it had just masked. Masking one and not the other is
 * worse than masking neither, because it reads as handled.
 *
 * Best-effort by construction: this is defence in depth for an operator-facing glance,
 * not a guarantee that a vendor cannot embed PII in some shape not matched here. The
 * durable control is the logger redact list (`lib/logger.ts`), which covers `lastError`
 * so the value never reaches structured logs in the first place.
 */

/** Anything address-shaped. Deliberately broad — over-scrubbing an error is harmless. */
const EMAIL_IN_TEXT = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/**
 * Vietnamese mobile numbers, with or without +84 / leading 0, tolerating the spaces,
 * dots and dashes people and vendors put in them. Bounded to 8-10 following digits so
 * it cannot swallow an arbitrary long digit run (an order id, a timestamp).
 */
const PHONE_IN_TEXT = /(?:\+?84|0)[\s.-]?\d(?:[\s.-]?\d){7,9}\b/g;

export function redactErrorText(text: string): string {
  return text.replace(EMAIL_IN_TEXT, '[email]').replace(PHONE_IN_TEXT, '[phone]');
}
