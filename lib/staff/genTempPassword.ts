/**
 * genTempPassword — cryptographically-random temporary password for new staff.
 *
 * Issue 017: staff are created with requiresPasswordChange=true and must rotate
 * this on first login (S10 forced-change gate). The temp password is sent once
 * via SMS (staffTempPassword template) and never persisted in plaintext.
 *
 * Charset excludes ambiguous glyphs (0/O, 1/l/I) so it can be read off an SMS.
 */

import crypto from 'crypto';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const LENGTH = 12;

// Largest multiple of CHARSET.length that fits in a byte; bytes >= this are
// rejected so every charset glyph is equally probable (no modulo bias).
const MAX_UNBIASED = 256 - (256 % CHARSET.length);

export function genTempPassword(): string {
  let out = '';
  while (out.length < LENGTH) {
    const bytes = crypto.randomBytes(LENGTH);
    for (let i = 0; i < bytes.length && out.length < LENGTH; i++) {
      if (bytes[i] < MAX_UNBIASED) out += CHARSET[bytes[i] % CHARSET.length];
    }
  }
  return out;
}
