/**
 * Unit tests for lib/auth/csrf.ts
 */

import { describe, it, expect } from 'vitest';
import { generateToken, compareTokens } from '../csrf';

describe('generateToken', () => {
  it('returns a 64-char hex string (32 bytes)', () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns distinct values on each call', () => {
    const t1 = generateToken();
    const t2 = generateToken();
    expect(t1).not.toBe(t2);
  });
});

describe('compareTokens', () => {
  it('returns true when tokens are equal', () => {
    const token = generateToken();
    expect(compareTokens(token, token)).toBe(true);
  });

  it('returns false when tokens are different', () => {
    const t1 = generateToken();
    const t2 = generateToken();
    expect(compareTokens(t1, t2)).toBe(false);
  });

  it('returns false when lengths differ without throwing', () => {
    const t1 = generateToken();
    const t2 = t1.slice(0, 32); // shorter
    expect(() => compareTokens(t1, t2)).not.toThrow();
    expect(compareTokens(t1, t2)).toBe(false);
  });

  it('returns false for empty strings', () => {
    expect(compareTokens('', '')).toBe(false);
  });
});
