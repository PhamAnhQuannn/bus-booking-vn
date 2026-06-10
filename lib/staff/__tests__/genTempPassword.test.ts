import { describe, it, expect } from 'vitest';
import { genTempPassword } from '../genTempPassword';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

describe('genTempPassword', () => {
  it('returns a 12-char password drawn only from the unambiguous charset', () => {
    for (let i = 0; i < 100; i++) {
      const pw = genTempPassword();
      expect(pw).toHaveLength(12);
      expect([...pw].every((c) => CHARSET.includes(c))).toBe(true);
    }
  });

  it('excludes ambiguous glyphs (0 O 1 l I)', () => {
    const joined = Array.from({ length: 200 }, () => genTempPassword()).join('');
    expect(/[0O1lI]/.test(joined)).toBe(false);
  });

  it('is unbiased — every charset glyph appears (rejection sampling, no modulo skew)', () => {
    // Largest byte rejected by the unbiased sampler; the naive `% 55` version would
    // over-represent the first 36 glyphs. Over a large sample every glyph should appear.
    const sample = Array.from({ length: 5000 }, () => genTempPassword()).join('');
    const seen = new Set(sample);
    for (const c of CHARSET) expect(seen.has(c)).toBe(true);
  });

  it('does not repeat (cryptographically random — collisions astronomically unlikely)', () => {
    const set = new Set(Array.from({ length: 500 }, () => genTempPassword()));
    expect(set.size).toBe(500);
  });
});
