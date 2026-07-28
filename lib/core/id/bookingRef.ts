/**
 * Human-readable booking reference.
 *
 * Format: BB-YYYY-XXXX-XXXX
 *   YYYY = 4-digit year in Asia/Ho_Chi_Minh (booking domicile timezone)
 *   XXXX-XXXX = 8 random base36 chars (lowercase), drawn from crypto.randomBytes
 *
 * Distinct from the opaque confirmationToken: bookingRef is shown to the user
 * (printed on tickets, read over phone) and may collide rarely — the DB unique
 * index is the source of truth; callers retry on collision (UNIQUE_VIOLATION
 * P2002) up to N times before surfacing an error.
 */

import crypto from 'crypto';

const BB_TZ = 'Asia/Ho_Chi_Minh';
const SEGMENT_LEN = 4;

function bbYear(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BB_TZ,
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
  return out.slice(0, len);
}

export function generateBookingRef(now: Date = new Date()): string {
  return `BB-${bbYear(now)}-${randomSegment(SEGMENT_LEN)}-${randomSegment(SEGMENT_LEN)}`;
}

export const BOOKING_REF_REGEX = /^BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}$/;
