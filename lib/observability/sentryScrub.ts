/**
 * #842: free-text PII scrub for Sentry events (server + browser `beforeSend`).
 *
 * The key-based `scrubPii` (./sentry.ts, inlined copy in instrumentation-client.ts) only
 * masks `extra`/`contexts` by key name. Exception messages/values and breadcrumbs carry
 * free text — a Prisma error quoting a row, a `console.log` breadcrumb, a fetch URL — that
 * can embed an email or VN phone number. This masks those by VALUE shape.
 *
 * CLIENT-SAFE: zero imports (instrumentation-client.ts deep-imports it into the browser
 * bundle). The patterns mirror lib/admin/redactErrorText.ts (#371/#394) — keep in sync;
 * they are duplicated, not imported, because that module sits behind a server barrel.
 * Best-effort defence in depth, not a guarantee.
 */

const EMAIL_IN_TEXT = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// VN mobile, with/without +84 / leading 0, tolerating spaces/dots/dashes; `(?<!\d)` keeps it
// from matching inside a longer digit run (order ids, txn refs) — see redactErrorText #394.
const PHONE_IN_TEXT = /(?<!\d)(?:\+?84|0)[\s.-]?\d(?:[\s.-]?\d){7,9}\b/g;

/** Mask emails and VN phone numbers in a free-text string. */
export function scrubText(text: string): string {
  return text.replace(EMAIL_IN_TEXT, '[email]').replace(PHONE_IN_TEXT, '[phone]');
}

/** Deep-scrub every string value (keys untouched). Cycle-safe. */
function scrubStrings(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === 'string') return scrubText(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => scrubStrings(v, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = scrubStrings(v, seen);
  }
  return out;
}

/** The subset of a Sentry event whose free text we scrub. */
interface ScrubbableEvent {
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  breadcrumbs?: Array<{ message?: string; data?: { [key: string]: unknown } }>;
}

/**
 * Scrub emails/phones from an event's message, exception values and breadcrumbs
 * (message + data). Mutates and returns the event (Sentry `beforeSend` contract).
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  if (typeof event.message === 'string') event.message = scrubText(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (typeof ex.value === 'string') ex.value = scrubText(ex.value);
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (typeof crumb.message === 'string') crumb.message = scrubText(crumb.message);
    if (crumb.data) crumb.data = scrubStrings(crumb.data) as { [key: string]: unknown };
  }
  return event;
}
