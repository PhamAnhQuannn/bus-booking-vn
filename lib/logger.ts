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
 * - phone                      — top-level phone PII (Issue 007)
 * - otp                        — top-level OTP code (Issue 007)
 * - otpProof                   — top-level OTP proof JWT (Issue 007)
 * - accessToken                — top-level access token (Issue 007)
 * - refreshToken               — top-level refresh token (Issue 007)
 * - *.password                 — plaintext password (Issue 007)
 * - *.passwordHash             — argon2id/scrypt hash (Issue 007)
 * - *.otpCode                  — OTP code (Issue 007)
 * - *.code                     — raw OTP code shorthand (Issue 007)
 * - *.accessToken              — JWT access token (Issue 007)
 * - *.refreshToken             — refresh token (Issue 007)
 * - *.refreshTokenHash         — stored refresh token hash (Issue 007)
 * - *.codeHash                 — stored OTP hash (Issue 007)
 * - newPassword                — plaintext new password (Issue 010)
 * - currentPassword            — plaintext current password (Issue 010)
 * - contactPhone               — operator contact phone PII (Issue 010)
 * - notificationPhone          — operator notification phone PII (Issue 010)
 * - *.address                  — pickup point street address (Issue 012)
 * - pickupAddress              — top-level pickup address shorthand (Issue 012)
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
      'phone',
      'otp',
      'otpProof',
      'accessToken',
      'refreshToken',
      '*.password',
      '*.passwordHash',
      '*.otpCode',
      '*.code',
      '*.accessToken',
      '*.refreshToken',
      '*.refreshTokenHash',
      '*.codeHash',
      'newPassword',
      'currentPassword',
      'contactPhone',
      'notificationPhone',
      '*.address',
      'pickupAddress',
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

