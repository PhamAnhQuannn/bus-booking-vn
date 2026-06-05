/**
 * TOTP primitive (Issue 055) — RFC 6238 (TOTP) over RFC 4226 (HOTP), node `crypto` only.
 *
 * NO third-party dependency: this repo is dependency-conscious and must build offline,
 * so the TOTP algorithm is implemented directly on `crypto.createHmac` (SHA-1).
 *
 * Secrets are RFC 4648 Base32 (uppercase A-Z2-7, no padding) — the encoding every
 * authenticator app (Google Authenticator, Authy, 1Password, …) expects.
 *
 * Security notes:
 *  - verifyTotp compares codes with crypto.timingSafeEqual on equal-length buffers
 *    (the candidate and the supplied code are both 6 ASCII digits → 6-byte buffers).
 *  - Non-6-digit / non-numeric input is rejected BEFORE any HMAC work (cheap reject,
 *    and avoids handing timingSafeEqual unequal-length buffers which would throw).
 *  - A ±`window` step tolerance (default ±1 = ±30s) absorbs client/server clock skew.
 */

import crypto from 'crypto';

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const SECRET_BYTES = 20; // 160-bit secret — RFC 4226 recommended for SHA-1

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // RFC 4648, no padding

// ---------------------------------------------------------------------------
// Base32 (RFC 4648, no padding)
// ---------------------------------------------------------------------------

/** Encode a buffer to an uppercase, unpadded RFC 4648 Base32 string. */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/**
 * Decode an uppercase RFC 4648 Base32 string (padding + lowercase tolerated) to a
 * Buffer. Throws on a non-Base32 character.
 */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/u, '').replace(/\s+/gu, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) throw new Error('Invalid Base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ---------------------------------------------------------------------------
// Secret generation + otpauth URI
// ---------------------------------------------------------------------------

/** Generate a fresh 160-bit TOTP secret as an unpadded Base32 string. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(SECRET_BYTES));
}

/**
 * Build the `otpauth://totp/...` URI an authenticator app scans / imports.
 * Label is `<issuer>:<email>`; issuer is repeated as a query param per the spec.
 */
export function totpAuthUri(secret: string, accountEmail: string, issuer = 'BusBookingVN'): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// HOTP / TOTP core
// ---------------------------------------------------------------------------

/** 8-byte big-endian counter buffer (RFC 4226 moving-factor). */
function counterToBuffer(counter: number): Buffer {
  const buf = Buffer.alloc(8);
  // JS bitwise ops are 32-bit; write hi/lo halves separately to stay exact.
  const hi = Math.floor(counter / 0x100000000);
  const lo = counter >>> 0;
  buf.writeUInt32BE(hi, 0);
  buf.writeUInt32BE(lo, 4);
  return buf;
}

/**
 * Compute the HOTP/TOTP code for a given step counter.
 * HMAC-SHA1(secret, counter) → RFC 4226 dynamic truncation → zero-padded 6-digit string.
 */
export function generateTotp(secret: string, timeStepCounter: number): string {
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(counterToBuffer(timeStepCounter)).digest();

  // Dynamic truncation (RFC 4226 §5.3).
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = binCode % 10 ** TOTP_DIGITS;
  return code.toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Verify a candidate TOTP `code` against `secret` at instant `atMs`, tolerating
 * ±`window` 30s steps of clock skew.
 *
 * Returns false (never throws) for any malformed input. The actual digit compare
 * uses crypto.timingSafeEqual on equal-length 6-byte buffers.
 */
export function verifyTotp(
  secret: string,
  code: string,
  atMs: number = Date.now(),
  window = 1
): boolean {
  // Cheap structural reject BEFORE any HMAC work: must be exactly 6 ASCII digits.
  // This also guarantees the timingSafeEqual buffers below are equal-length.
  if (typeof code !== 'string' || !/^\d{6}$/u.test(code)) return false;

  let secretValid = true;
  try {
    base32Decode(secret);
  } catch {
    secretValid = false;
  }
  if (!secretValid || !secret) return false;

  const counter = Math.floor(atMs / 1000 / TOTP_PERIOD_SECONDS);
  const codeBuf = Buffer.from(code, 'ascii');

  for (let i = -window; i <= window; i++) {
    const candidate = generateTotp(secret, counter + i);
    const candidateBuf = Buffer.from(candidate, 'ascii');
    if (candidateBuf.length === codeBuf.length && crypto.timingSafeEqual(candidateBuf, codeBuf)) {
      return true;
    }
  }
  return false;
}
