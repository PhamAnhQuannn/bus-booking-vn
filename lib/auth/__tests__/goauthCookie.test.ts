/**
 * Unit tests for lib/auth/goauthCookie.ts — the signed bb_goauth handshake cookie.
 * Round-trip of {state, verifier}, tamper→null, missing secret→throw, header flags.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildGoauthCookieValue,
  buildGoauthSetCookieHeader,
  buildGoauthClearCookieHeader,
  readGoauthCookieValue,
  readGoauthCookie,
  GOAUTH_COOKIE_NAME,
} from '../goauthCookie';

const PREV = process.env.GOAUTH_COOKIE_SECRET;

beforeEach(() => {
  process.env.GOAUTH_COOKIE_SECRET = 's'.repeat(32);
});
afterEach(() => {
  if (PREV === undefined) delete process.env.GOAUTH_COOKIE_SECRET;
  else process.env.GOAUTH_COOKIE_SECRET = PREV;
});

describe('goauthCookie', () => {
  it('round-trips {state, verifier}', () => {
    const value = buildGoauthCookieValue({ state: 'st-123', verifier: 'vf-456' });
    expect(readGoauthCookieValue(value)).toEqual({ state: 'st-123', verifier: 'vf-456' });
  });

  it('round-trips an optional returnTo', () => {
    const value = buildGoauthCookieValue({ state: 'st', verifier: 'vf', returnTo: '/account/bookings' });
    expect(readGoauthCookieValue(value)).toEqual({ state: 'st', verifier: 'vf', returnTo: '/account/bookings' });
  });

  it('omits returnTo from the parsed result when it was not set', () => {
    const value = buildGoauthCookieValue({ state: 'st', verifier: 'vf' });
    expect(readGoauthCookieValue(value)).toEqual({ state: 'st', verifier: 'vf' });
  });

  it('returns null on a tampered value', () => {
    const value = buildGoauthCookieValue({ state: 'st', verifier: 'vf' });
    const tampered = 'A' + value.slice(1);
    expect(readGoauthCookieValue(tampered)).toBeNull();
  });

  it('returns null when signed under a different secret', () => {
    const value = buildGoauthCookieValue({ state: 'st', verifier: 'vf' });
    process.env.GOAUTH_COOKIE_SECRET = 'x'.repeat(32);
    expect(readGoauthCookieValue(value)).toBeNull();
  });

  it('extracts + verifies from a full Cookie header', () => {
    const value = buildGoauthCookieValue({ state: 'st', verifier: 'vf' });
    const header = `foo=bar; ${GOAUTH_COOKIE_NAME}=${value}; baz=qux`;
    expect(readGoauthCookie(header)).toEqual({ state: 'st', verifier: 'vf' });
  });

  it('returns null when the cookie is absent from the header', () => {
    expect(readGoauthCookie('foo=bar; baz=qux')).toBeNull();
    expect(readGoauthCookie(null)).toBeNull();
  });

  it('Set-Cookie header carries HttpOnly + SameSite=Lax + Max-Age', () => {
    const header = buildGoauthSetCookieHeader({ state: 'st', verifier: 'vf' });
    expect(header).toContain(`${GOAUTH_COOKIE_NAME}=`);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Max-Age=600');
  });

  it('clear header sets Max-Age=0', () => {
    const header = buildGoauthClearCookieHeader();
    expect(header).toContain(`${GOAUTH_COOKIE_NAME}=;`);
    expect(header).toContain('Max-Age=0');
  });

  it('throws when GOAUTH_COOKIE_SECRET is missing', () => {
    delete process.env.GOAUTH_COOKIE_SECRET;
    expect(() => buildGoauthCookieValue({ state: 'st', verifier: 'vf' })).toThrow(
      /GOAUTH_COOKIE_SECRET/
    );
  });

  it('throws when GOAUTH_COOKIE_SECRET is too short', () => {
    process.env.GOAUTH_COOKIE_SECRET = 'short';
    expect(() => buildGoauthCookieValue({ state: 'st', verifier: 'vf' })).toThrow(
      /GOAUTH_COOKIE_SECRET/
    );
  });
});
