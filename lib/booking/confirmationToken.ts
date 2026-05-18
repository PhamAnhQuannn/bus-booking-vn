/**
 * Opaque confirmation token for booking confirmation links.
 *
 * Separate from the booking's UUID id (which is UUIDv7 — timestamp-ordered).
 * The token is shown to the user (URL) so it must NOT leak booking ordering,
 * creation time, or anything enumerable. 192 bits base64url ≈ 32 chars.
 */

import crypto from 'crypto';

const TOKEN_BYTES = 24;

export function generateConfirmationToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

export const CONFIRMATION_TOKEN_REGEX = /^[A-Za-z0-9_-]{32}$/;
