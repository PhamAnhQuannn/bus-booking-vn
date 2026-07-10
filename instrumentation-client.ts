/**
 * Next.js 16 client instrumentation hook (Issue 281).
 *
 * Initializes the Sentry browser SDK when SENTRY_DSN is set. This file is
 * loaded by Next.js in the browser bundle — it must NOT import server-only
 * modules (lib/logger, lib/config, etc.).
 *
 * PII scrubbing: the `beforeSend` hook strips sensitive keys from event extras
 * using the same key list as the server-side `scrubPii`. The list is inlined
 * here (not imported) to avoid pulling server-only transitive deps into the
 * client bundle.
 */

import * as Sentry from '@sentry/nextjs';

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
  ].map((k) => k.toLowerCase()),
);

const REDACTED = '[REDACTED]';

function scrubClientPii(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return '[Circular]';
  seen.add(value as object);
  if (Array.isArray(value)) return value.map((v) => scrubClientPii(v, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase())
      ? REDACTED
      : scrubClientPii(v, seen);
  }
  return out;
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.extra) {
        event.extra = scrubClientPii(event.extra) as Record<string, unknown>;
      }
      if (event.contexts) {
        event.contexts = scrubClientPii(
          event.contexts,
        ) as typeof event.contexts;
      }
      return event;
    },
  });
}
