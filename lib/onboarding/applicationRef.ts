/**
 * Issue 076: human-readable operator application reference.
 *
 * Format: OP-YYYY-XXXXXX
 *   YYYY   = 4-digit year in Asia/Ho_Chi_Minh (operator domicile timezone)
 *   XXXXXX = 6 random base36 chars (uppercase), drawn from crypto.randomBytes
 *
 * Shown to the applicant on the confirmation page and in the pending email.
 * Mirrors lib/booking/bookingRef.ts: the DB unique index is the source of truth,
 * so callers retry on collision (P2002) up to N times before surfacing an error.
 * Uppercase (vs bookingRef's lowercase) so it reads cleanly over the phone /
 * in an email and never collides with a booking ref by eye.
 */

import crypto from 'crypto';

const OP_TZ = 'Asia/Ho_Chi_Minh';
const SEGMENT_LEN = 6;

function opYear(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: OP_TZ,
    year: 'numeric',
  }).format(now);
}

function randomSegment(len: number): string {
  const bytes = crypto.randomBytes(len * 2);
  let out = '';
  for (let i = 0; i < bytes.length && out.length < len; i++) {
    const c = bytes[i].toString(36);
    if (/^[0-9a-z]$/.test(c)) out += c;
  }
  while (out.length < len) {
    out += crypto.randomBytes(1)[0].toString(36).charAt(0) || '0';
  }
  return out.slice(0, len).toUpperCase();
}

export function generateApplicationRef(now: Date = new Date()): string {
  return `OP-${opYear(now)}-${randomSegment(SEGMENT_LEN)}`;
}

export const APPLICATION_REF_REGEX = /^OP-\d{4}-[0-9A-Z]{6}$/;
