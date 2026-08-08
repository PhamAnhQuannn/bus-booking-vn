/**
 * Unit tests for lib/auth/safeReturnTo.ts (issue 021 — post-login open-redirect guard).
 */

import { describe, it, expect } from 'vitest';
import { safeReturnTo } from '../safeReturnTo';

describe('safeReturnTo', () => {
  it('passes through same-origin relative paths', () => {
    expect(safeReturnTo('/account/bookings')).toBe('/account/bookings');
    expect(safeReturnTo('/')).toBe('/');
    expect(safeReturnTo('/search?origin=A&destination=B')).toBe('/search?origin=A&destination=B');
  });

  it('rejects absolute URLs', () => {
    expect(safeReturnTo('https://evil.tld')).toBe('/');
    expect(safeReturnTo('http://evil.tld/path')).toBe('/');
  });

  it('rejects protocol-relative and backslash tricks', () => {
    expect(safeReturnTo('//evil.tld')).toBe('/');
    expect(safeReturnTo('/\\evil.tld')).toBe('/');
    expect(safeReturnTo('/\\/evil.tld')).toBe('/');
  });

  it('rejects non-path values and falls back', () => {
    expect(safeReturnTo('javascript:alert(1)')).toBe('/');
    expect(safeReturnTo('account/bookings')).toBe('/'); // missing leading slash
  });

  it('rejects embedded control characters that URL parsers strip', () => {
    // `/\t/evil.tld` passes the leading-slash regex but new URL() strips the tab,
    // collapsing it to `//evil.tld` (protocol-relative, cross-origin).
    expect(safeReturnTo('/\t/evil.tld')).toBe('/');
    expect(safeReturnTo('/\n/evil.tld')).toBe('/');
    expect(safeReturnTo('/\r/evil.tld')).toBe('/');
    expect(safeReturnTo('/\x00/evil.tld')).toBe('/');
    // The regression assertion: the sanitized value must resolve same-origin.
    expect(new URL(safeReturnTo('/\t/evil.tld'), 'https://lenxevn.com').origin).toBe(
      'https://lenxevn.com'
    );
  });

  it('returns the fallback for null/undefined/empty', () => {
    expect(safeReturnTo(null)).toBe('/');
    expect(safeReturnTo(undefined)).toBe('/');
    expect(safeReturnTo('')).toBe('/');
  });

  it('honors a custom fallback', () => {
    expect(safeReturnTo('https://evil.tld', '/auth/login')).toBe('/auth/login');
    expect(safeReturnTo(null, '/home')).toBe('/home');
  });
});
