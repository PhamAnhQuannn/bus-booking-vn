/**
 * Pino logger with PII redaction.
 *
 * Redacted paths per AC-11:
 * - req.query      — search params contain origin/destination/date
 * - req.url        — full URL may include query string
 * - req.headers.authorization — bearer tokens
 */

import pino, { type LoggerOptions } from 'pino';

export const loggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: {
    paths: ['req.query', 'req.url', 'req.headers.authorization'],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
};

export const logger = pino(loggerOptions);

