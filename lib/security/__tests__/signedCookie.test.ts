/**
 * Unit tests for lib/security/signedCookie.ts — the generic HMAC-SHA256 signed-value
 * codec. Round-trip, tamper detection, wrong-secret rejection, malformed input.
 */

import { describe, it, expect } from 'vitest';
import { signValue, unsignValue } from '../signedCookie';

const SECRET = 'k'.repeat(32);
const OTHER = 'z'.repeat(32);

describe('signValue / unsignValue', () => {
  it('round-trips an arbitrary value', () => {
    const signed = signValue('hello-world', SECRET);
    expect(unsignValue(signed, SECRET)).toBe('hello-world');
  });

  it('round-trips a value that itself contains dots (splits on the LAST dot)', () => {
    const value = 'a.b.c.d';
    const signed = signValue(value, SECRET);
    expect(unsignValue(signed, SECRET)).toBe(value);
  });

  it('rejects a tampered value', () => {
    const signed = signValue('hello', SECRET);
    const tampered = signed.replace(/^hello/, 'hell0');
    expect(unsignValue(tampered, SECRET)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const signed = signValue('hello', SECRET);
    const lastDot = signed.lastIndexOf('.');
    const tampered = signed.slice(0, lastDot + 1) + 'AAAA';
    expect(unsignValue(tampered, SECRET)).toBeNull();
  });

  it('rejects a value signed with a different secret', () => {
    const signed = signValue('hello', SECRET);
    expect(unsignValue(signed, OTHER)).toBeNull();
  });

  it('returns null for input with no signature segment', () => {
    expect(unsignValue('novalue', SECRET)).toBeNull();
  });

  it('returns null for a leading-dot input (empty value)', () => {
    expect(unsignValue('.sig', SECRET)).toBeNull();
  });

  it('returns null for a trailing-dot input (empty signature)', () => {
    expect(unsignValue('value.', SECRET)).toBeNull();
  });
});
