/**
 * Ticket signed-token utilities (Issue 071) — HS256 via jose, DEDICATED key.
 *
 * mintTicketToken(booking)  → compact JWT, scope='ticket', claims = ONLY the
 *                             lookup keys { ref, ct }. DETERMINISTIC + STABLE.
 * verifyTicketToken(token)  → { ref, ct } | null (null on any failure).
 *
 * ── Design decisions ──────────────────────────────────────────────────────
 *
 * Dedicated key (getTicketSecret / TICKET_SECRET) — SEPARATE from JWT_SECRET so
 * a compromise of one realm's key cannot forge the other's tokens. Mirrors the
 * getSecret() pattern in lib/auth/jwt.ts. Test fallback: 't'.repeat(32) when
 * NODE_ENV === 'test' (mirrors the JWT_SECRET fallback 'a'.repeat(32)).
 *
 * No PII — the token carries ONLY the two lookup keys (bookingRef +
 * confirmationToken). No name / phone / amount / trip details. The verify page
 * does a fresh DB read keyed on { ref, ct } for the live trip + status, so the
 * token is a tamper-evident LOOKUP POINTER, not a self-describing bearer
 * credential. A scanned QR reveals nothing about the passenger by itself.
 *
 * Deterministic (AC4) — re-minting the SAME booking MUST produce a byte-identical
 * string so a reprinted ticket / re-rendered QR is stable. We therefore:
 *   - do NOT call setIssuedAt() (no Date.now() in the signature input), and
 *   - do NOT call setJti() / any random claim.
 * HS256 is deterministic given identical header + payload + key, so two mints of
 * the same { ref, ct } yield the identical compact JWT.
 *
 * No expiry — a boarding QR must verify at boarding time, possibly DAYS after
 * issue. A fixed exp would either expire a valid ticket or be arbitrary. Since
 * the token is only a tamper-evident lookup pointer (the verify page re-checks
 * trip departure + booking status against the live DB), it needs no exp of its
 * own: validity is governed by the DB row, not the token clock. Omitting exp
 * also keeps the mint deterministic (no time-derived claim).
 *
 * Cross-token guard — verifyTicketToken uses the dedicated TICKET_SECRET AND
 * requires scope==='ticket'. A JWT_SECRET-signed token (customer/operator/admin
 * access or otpProof) fails the signature check under the ticket key, and even a
 * hypothetical same-key token without scope==='ticket' is rejected.
 */

import { SignJWT, jwtVerify } from 'jose';

/** Lookup claims embedded in a ticket token — the ONLY data it carries. */
export interface TicketTokenClaims {
  /** Booking reference (Booking.bookingRef, unique). */
  ref: string;
  /** Confirmation token (Booking.confirmationToken, unique). */
  ct: string;
}

const TICKET_SCOPE = 'ticket' as const;

/**
 * Dedicated ticketing signing key. Separate from JWT_SECRET (lib/auth/jwt.ts).
 * Test fallback mirrors the JWT getter: 't'.repeat(32) under NODE_ENV==='test'.
 */
function getTicketSecret(): Uint8Array {
  const raw =
    process.env.TICKET_SECRET ??
    (process.env.NODE_ENV === 'production' ? null : 'tk'.repeat(16));
  if (!raw) throw new Error('TICKET_SECRET not configured');
  return new TextEncoder().encode(raw);
}

/**
 * Mint a deterministic, stable ticket lookup token for a booking.
 * Returns a compact HS256 JWT with scope='ticket' and claims { ref, ct } only.
 * No iat, no exp, no jti — see module header for the determinism rationale.
 * Two mints of the same booking produce a byte-identical string (AC4).
 */
export async function mintTicketToken(booking: {
  bookingRef: string;
  confirmationToken: string;
}): Promise<string> {
  return new SignJWT({
    scope: TICKET_SCOPE,
    ref: booking.bookingRef,
    ct: booking.confirmationToken,
  })
    .setProtectedHeader({ alg: 'HS256' })
    // Intentionally NO setIssuedAt / setExpirationTime / setJti — determinism.
    .sign(getTicketSecret());
}

/**
 * Verify a ticket token.
 * Returns { ref, ct } on success, null on ANY failure (tamper, wrong key,
 * malformed, missing/incorrect scope, missing claims).
 * Rejects non-ticket tokens via the dedicated key + scope==='ticket' guard.
 */
export async function verifyTicketToken(
  token: string,
): Promise<TicketTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getTicketSecret(), {
      algorithms: ['HS256'],
    });
    if (payload['scope'] !== TICKET_SCOPE) return null;
    const ref = payload['ref'];
    const ct = payload['ct'];
    if (typeof ref !== 'string' || ref.length === 0) return null;
    if (typeof ct !== 'string' || ct.length === 0) return null;
    return { ref, ct };
  } catch {
    return null;
  }
}
