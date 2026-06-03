/**
 * Issue 071 — ticket signed-token tests (the security core).
 *
 * Covers: round-trip, determinism (AC4), tamper rejection, wrong-key rejection,
 * no-PII payload, and the cross-token guard (a JWT_SECRET-signed token must NOT
 * verify as a ticket token).
 */

import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { mintTicketToken, verifyTicketToken } from '../ticketToken';

const BOOKING = {
  bookingRef: 'BB-2026-ab12-cd34',
  confirmationToken: 'conf_tok_0123456789abcdef',
};

function decodePayload(token: string): Record<string, unknown> {
  const [, payloadB64] = token.split('.');
  const json = Buffer.from(payloadB64, 'base64url').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}

describe('mintTicketToken / verifyTicketToken', () => {
  it('round-trips: verify returns the lookup keys', async () => {
    const token = await mintTicketToken(BOOKING);
    const claims = await verifyTicketToken(token);
    expect(claims).toEqual({
      ref: BOOKING.bookingRef,
      ct: BOOKING.confirmationToken,
    });
  });

  it('AC4: mint is deterministic — two mints are byte-identical', async () => {
    const a = await mintTicketToken(BOOKING);
    const b = await mintTicketToken(BOOKING);
    expect(a).toBe(b);
  });

  it('different bookings produce different tokens', async () => {
    const a = await mintTicketToken(BOOKING);
    const b = await mintTicketToken({
      bookingRef: 'BB-2026-zz99-yy88',
      confirmationToken: 'conf_tok_different',
    });
    expect(a).not.toBe(b);
  });

  it('rejects a tampered token (single char flipped) → null', async () => {
    const token = await mintTicketToken(BOOKING);
    // Flip a char in the payload segment.
    const parts = token.split('.');
    const payload = parts[1];
    const flippedChar = payload[5] === 'A' ? 'B' : 'A';
    parts[1] = payload.slice(0, 5) + flippedChar + payload.slice(6);
    const tampered = parts.join('.');
    expect(tampered).not.toBe(token);
    expect(await verifyTicketToken(tampered)).toBeNull();
  });

  it('rejects a token signed with the WRONG key → null', async () => {
    const wrong = new TextEncoder().encode('w'.repeat(32));
    const forged = await new SignJWT({
      scope: 'ticket',
      ref: BOOKING.bookingRef,
      ct: BOOKING.confirmationToken,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(wrong);
    expect(await verifyTicketToken(forged)).toBeNull();
  });

  it('rejects malformed input → null', async () => {
    expect(await verifyTicketToken('not-a-jwt')).toBeNull();
    expect(await verifyTicketToken('')).toBeNull();
    expect(await verifyTicketToken('a.b.c')).toBeNull();
  });

  it('payload carries NO PII — only ref, ct, scope', async () => {
    const token = await mintTicketToken(BOOKING);
    const payload = decodePayload(token);
    expect(new Set(Object.keys(payload))).toEqual(
      new Set(['scope', 'ref', 'ct']),
    );
    // explicit absences
    expect(payload['name']).toBeUndefined();
    expect(payload['phone']).toBeUndefined();
    expect(payload['amount']).toBeUndefined();
    expect(payload['buyerName']).toBeUndefined();
    expect(payload['buyerPhone']).toBeUndefined();
    // no iat / exp / jti (determinism guarantee)
    expect(payload['iat']).toBeUndefined();
    expect(payload['exp']).toBeUndefined();
    expect(payload['jti']).toBeUndefined();
    expect(payload['scope']).toBe('ticket');
  });

  it('cross-token guard: a JWT_SECRET-signed token does NOT verify here', async () => {
    // Mint a token with the JWT realm key (test fallback 'a'.repeat(32)) — even
    // if it carried scope='ticket', the ticket key ('t'.repeat(32)) differs so
    // the signature check fails.
    const jwtKey = new TextEncoder().encode('a'.repeat(32));
    const customerLike = await new SignJWT({ role: 'customer', scope: 'ticket' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('cust_123')
      .sign(jwtKey);
    expect(await verifyTicketToken(customerLike)).toBeNull();
  });

  it('rejects a ticket-key token missing scope=ticket → null', async () => {
    // Same dedicated key but wrong/absent scope must still fail.
    const ticketKey = new TextEncoder().encode('t'.repeat(32));
    const noScope = await new SignJWT({ ref: 'r', ct: 'c' })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(ticketKey);
    expect(await verifyTicketToken(noScope)).toBeNull();

    const wrongScope = await new SignJWT({ scope: 'admin', ref: 'r', ct: 'c' })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(ticketKey);
    expect(await verifyTicketToken(wrongScope)).toBeNull();
  });
});
