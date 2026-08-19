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
 * - customerEmail              — hold-level buyer email PII (Issue 042)
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
 * - pickupDetail               — traveler free-text pickup detail / location PII (Issue 104)
 * - customPickup               — custom pickup request location text in operator SMS payload (Issue 111)
 * - escalationNote             — operator escalation note (Issue 014)
 * - buyerPhone                 — manual booking buyer phone PII (Issue 015)
 * - buyerName                  — manual booking buyer name PII (Issue 015)
 * - buyerEmail                 — booking buyer email PII (Issue 042)
 * - email / *.email            — bare/nested email key — defense-in-depth (#494)
 * - *.recipient                — NotificationLog/Payout recipient phone (Issue 019)
 * - totpSecret                 — top-level TOTP shared secret (Issue 055)
 * - *.totpSecret               — nested TOTP shared secret — a logged secret = full 2FA compromise (Issue 055)
 * - totpCode                   — top-level TOTP code (Issue 055)
 *   (raw body `code` is already covered by the existing `*.code` path)
 * - accountNumber              — payout-account bank number — sensitive PII (Issue 078)
 * - *.accountNumber            — nested payout-account number; a leaked bank account
 *   number is a real, direct harm (Issue 078)
 * - GOOGLE_CLIENT_SECRET       — Google OAuth client secret (ADR-021)
 * - id_token / *.id_token      — Google OIDC id_token (PII claims + bearer-adjacent)
 * - access_token / *          — Google token-exchange (snake_case; camelCase already covered)
 * - refresh_token / *         — Google token-exchange refresh token
 * - code_verifier / *         — Google OAuth PKCE verifier
 * - state / *                 — Google OAuth CSRF state (broad key; over-redaction is safe)
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
      'customerEmail',
      // Vendor error strings echo the address they failed on — Resend puts the
      // recipient into error.message (lib/notification/email.ts), so logging
      // lastError unredacted re-leaks the value '*.recipient' below already masks.
      'lastError',
      '*.lastError',
      'bb_hold',
      'HOLD_SECRET',
      'phone',
      'otp',
      'otpProof',
      'loginChallenge',
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
      'tempPassword',
      '*.tempPassword',
      'tempPasswordPlain',
      '*.tempPasswordPlain',
      'confirmationToken',
      '*.confirmationToken',
      'contactPhone',
      'notificationPhone',
      '*.address',
      'pickupAddress',
      'pickupDetail',
      'customPickup',            // Issue 111: custom pickup request location text (PII)
      'escalationNote',
      'buyerPhone',
      'buyerName',
      'buyerEmail',
      'email',                   // #494: bare top-level email key — defense-in-depth (customerEmail/buyerEmail already covered)
      '*.email',                 // #494: nested email key
      '*.recipient',
      'newPhone',                // Issue 008: phone-change new phone (PII)
      'totpSecret',              // Issue 055: top-level TOTP shared secret
      '*.totpSecret',            // Issue 055: nested TOTP shared secret (2FA compromise)
      'totpCode',                // Issue 055: top-level TOTP code (body.code covered by *.code)
      'accountNumber',           // Issue 078: payout-account bank number (sensitive PII)
      '*.accountNumber',         // Issue 078: nested payout-account number (real harm if leaked)
      'rawBody',                 // #332: PaymentEvent raw webhook body — carries payer name/bank account (SePay). Not logged today; redact so an accidentally-logged PaymentEvent row can't leak it.
      '*.rawBody',               // #332: nested PaymentEvent.rawBody
      'ESMS_API_KEY',            // SMS-OTP: eSMS provider credential
      'ESMS_SECRET_KEY',         // SMS-OTP: eSMS provider credential (never log)
      'MISA_API_KEY',            // e-invoice: MISA meInvoice API key (never log)
      'RESEND_API_KEY',          // email: Resend transactional email API key (never log)
      'SEPAY_API_KEY',           // bank transfer: SePay webhook bearer token (never log)
      'GEMINI_API_KEY',          // planner chat: Gemini Generative Language API key (never log)
      'VNPAY_HASH_SECRET',       // VNPay: HMAC-SHA512 signing secret (never log)
      'VNPAY_TMN_CODE',          // VNPay: merchant terminal code (never log)
      'GOOGLE_CLIENT_SECRET',    // Google OAuth: client secret (never log)
      'id_token',                // Google OAuth: OIDC id_token (PII-bearing claims + bearer-adjacent)
      '*.id_token',
      'access_token',            // Google OAuth: token-exchange response (snake_case; camelCase accessToken already covered)
      '*.access_token',
      'refresh_token',           // Google OAuth: token-exchange response (not persisted, but may transit logs)
      '*.refresh_token',
      'code_verifier',           // Google OAuth: PKCE verifier
      '*.code_verifier',
      // Google OAuth CSRF state — broad key name, intentionally redacted; over-redaction
      // is the safe failure mode (no current caller logs a business `state`).
      'state',
      '*.state',
      // Google OAuth subject — the stable pseudonymous user id (OIDC `sub`, persisted as
      // Account.providerAccountId). Not a secret, but a durable identity linkage; redact so
      // an accidentally-logged identity object can't leak it.
      'sub',
      '*.sub',
      'providerAccountId',
      '*.providerAccountId',
      // #477: Session.userAgent — client UA captured for active-devices. PII (fingerprintable);
      // never logged today, redact so an accidentally-logged Session object can't leak it. IP is
      // deliberately NOT globally redacted here — rate-limit forensics log `ip` on purpose.
      'userAgent',
      '*.userAgent',
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

