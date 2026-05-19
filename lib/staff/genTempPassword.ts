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

export function genTempPassword(): string {
  const bytes = crypto.randomBytes(LENGTH);
  let out = '';
  for (let i = 0; i < LENGTH; i++) {
    out += CHARSET[bytes[i] % CHARSET.length];
  }
  return out;
}
