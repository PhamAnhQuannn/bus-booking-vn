/**
 * Sentry error-reporting ABSTRACTION (Issue 061, AC4/AC5).
 *
 * The seam ships now; the real `@sentry/nextjs` SDK is DEFERRED (not installed —
 * offline / dep-conscious), the same "defer real, ship the seam" pattern as the
 * refund PSP and the S3 storage stub.
 *
 *   getEnv().SENTRY_DSN UNSET → fallback sink: emit the (PII-scrubbed) event to
 *                              the structured pino logger with `sentry:'fallback'`.
 *   getEnv().SENTRY_DSN SET   → Stage-1 will forward to the real client here. The
 *                              PII scrubbing already runs regardless, so no PII can
 *                              ship even once the real SDK's beforeSend is wired.
 *
 * INVARIANT: observability must NEVER break the request. Both functions are
 * synchronous and swallow every internal error — a failure to report is logged
 * (best-effort) but never thrown to the caller.
 *
 * PII scrubbing (AC4): `scrubPii` deep-replaces any key matching the logger's
 * redact list (lib/logger.ts) with '[REDACTED]', so a context object carrying
 * `phone` / `accessToken` / `otpProof` / `codeHash` / `recipient` / … is masked
 * before it reaches any sink.
 */

import { logger } from '@/lib/logger';
import { getEnv } from '@/lib/config';

/**
 * Sensitive key names mirrored from the pino redact list (lib/logger.ts).
 * Matching is case-insensitive and unanchored to the `*.<key>` wildcards there:
 * we redact a key if its lowercased name EQUALS one of these. Keep this set in
 * sync with lib/logger.ts whenever a new PII path is added.
 */
const REDACT_KEYS = new Set(
  [
    'customerPhone',
    'customerName',
    'customerEmail',
    'bb_hold',
    'HOLD_SECRET',
    'phone',
    'otp',
    'otpProof',
    'accessToken',
    'refreshToken',
    'password',
    'passwordHash',
    'otpCode',
    'code',
    'refreshTokenHash',
    'codeHash',
    'newPassword',
    'currentPassword',
    'tempPassword',
    'contactPhone',
    'notificationPhone',
    'address',
    'pickupAddress',
    'pickupDetail',
    'escalationNote',
    'buyerPhone',
    'buyerName',
    'buyerEmail',
    'recipient',
    'newPhone',
    'totpSecret',
    'totpCode',
    'authorization',
    'cookie',
  ].map((k) => k.toLowerCase())
);

const REDACTED = '[REDACTED]';

/** True if a key name should be masked (case-insensitive match against REDACT_KEYS). */
function isSensitiveKey(key: string): boolean {
  return REDACT_KEYS.has(key.toLowerCase());
}

/**
 * Deep-clone `value`, replacing any sensitive key with '[REDACTED]'. Cycle-safe
 * (via a seen-set) and non-throwing — on any unexpected shape it returns a
 * best-effort scrub rather than throwing. Arrays are recursed element-wise.
 */
export function scrubPii(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return '[Circular]';
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => scrubPii(v, seen));
  }

  // Error → keep name + scrubbed message; never recurse arbitrary props.
  if (value instanceof Error) {
    return { name: value.name, message: scrubMessage(value.message) };
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitiveKey(k) ? REDACTED : scrubPii(v, seen);
  }
  return out;
}

/**
 * Best-effort scrub of a free-text message/stack: mask the value of any
 * `<sensitiveKey>=...` or `<sensitiveKey>: ...` token. This is intentionally
 * conservative — structured `context` is the primary scrubbing surface; this
 * just stops the most obvious `phone=+84...` style leak in a thrown message.
 */
function scrubMessage(message: string): string {
  let out = message;
  for (const key of REDACT_KEYS) {
    // key=value or key: value (value = run of non-space/comma chars)
    const re = new RegExp(`(${escapeRegExp(key)}\\s*[:=]\\s*)([^\\s,;]+)`, 'gi');
    out = out.replace(re, `$1${REDACTED}`);
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalize an unknown thrown value into a loggable, PII-scrubbed shape. */
function normalizeError(err: unknown): { name: string; message: string } {
  if (err instanceof Error) {
    return { name: err.name, message: scrubMessage(err.message) };
  }
  return { name: 'NonError', message: scrubMessage(String(err)) };
}

/**
 * Report an exception to the error sink. Non-throwing.
 * @param err     the thrown value (Error or anything).
 * @param context optional structured context — PII-scrubbed before emit.
 */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  try {
    const scrubbedContext = (context ? scrubPii(context) : {}) as Record<string, unknown>;
    const errInfo = normalizeError(err);

    let dsn: string | undefined;
    try {
      dsn = getEnv().SENTRY_DSN;
    } catch {
      // env not yet validated (e.g. mid-test) → behave as if unset (fallback sink).
      dsn = undefined;
    }

    if (dsn) {
      // TODO(stage1): forward to @sentry/nextjs here, e.g.
      //   Sentry.captureException(err, { extra: scrubbedContext });
      // The real init lives in instrumentation.ts (server) when SENTRY_DSN is set.
      // The scrubbing above is the beforeSend equivalent and runs regardless.
      logger.error(
        { err: errInfo, ...scrubbedContext, sentry: 'forward' },
        errInfo.message
      );
      return;
    }

    // Fallback sink: structured logger.
    logger.error(
      { err: errInfo, ...scrubbedContext, sentry: 'fallback' },
      errInfo.message
    );
  } catch {
    // Observability must never break the request — swallow everything.
  }
}

/**
 * Report a message to the error sink. Non-throwing.
 * @param message human-readable message — scrubbed before emit.
 * @param context optional structured context — PII-scrubbed before emit.
 */
export function captureMessage(message: string, context?: Record<string, unknown>): void {
  try {
    const scrubbedContext = (context ? scrubPii(context) : {}) as Record<string, unknown>;
    const scrubbed = scrubMessage(message);

    let dsn: string | undefined;
    try {
      dsn = getEnv().SENTRY_DSN;
    } catch {
      dsn = undefined;
    }

    if (dsn) {
      // TODO(stage1): forward to @sentry/nextjs Sentry.captureMessage(...) here.
      logger.error({ ...scrubbedContext, sentry: 'forward' }, scrubbed);
      return;
    }

    logger.error({ ...scrubbedContext, sentry: 'fallback' }, scrubbed);
  } catch {
    // Observability must never break the request — swallow everything.
  }
}
