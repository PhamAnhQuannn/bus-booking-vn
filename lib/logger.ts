/**
 * Pino logger with PII redaction.
 *
 * Redacted paths:
 * - req.query                  — search params contain origin/destination/date
 * - req.url                    — full URL may include query string
 * - req.headers.authorization  — bearer tokens
 * - req.headers.cookie         — contains bb_hold cookie value
 * - customerPhone              — buyer PII (Issue 002)
 * - customerName               — buyer PII (Issue 002)
 * - bb_hold                    — signed cookie value (Issue 002)
 * - HOLD_SECRET                — HMAC signing key (Issue 002)
 */

import pino, { type LoggerOptions } from 'pino';

export const loggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: {
    paths: [
      'req.query',
      'req.url',
      'req.headers.authorization',
      'req.headers.cookie',
      'customerPhone',
      'customerName',
      'bb_hold',
      'HOLD_SECRET',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
};

export const logger = pino(loggerOptions);

