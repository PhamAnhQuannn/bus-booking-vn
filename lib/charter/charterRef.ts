/**
 * Issue 081: human-readable charter-request reference.
 *
 * Format: CH-YYYY-XXXXXX
 *   YYYY   = 4-digit year in Asia/Ho_Chi_Minh (charter domicile timezone)
 *   XXXXXX = 6 random base36 chars (uppercase), drawn from crypto.randomBytes
 *
 * Mirrors lib/onboarding/applicationRef.ts: the DB unique index on
 * CharterRequest.ref is the source of truth, so callers retry on collision
 * (P2002) up to N times before surfacing an error. Uppercase so it reads cleanly
 * over the phone / in an email and never collides with a booking ref (lowercase)
 * or an operator application ref (OP- prefix) by eye.
 */

import crypto from 'crypto';

const CH_TZ = 'Asia/Ho_Chi_Minh';
const SEGMENT_LEN = 6;

function chYear(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CH_TZ,
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

export function generateCharterRef(now: Date = new Date()): string {
  return `CH-${chYear(now)}-${randomSegment(SEGMENT_LEN)}`;
}

export const CHARTER_REF_REGEX = /^CH-\d{4}-[0-9A-Z]{6}$/;
