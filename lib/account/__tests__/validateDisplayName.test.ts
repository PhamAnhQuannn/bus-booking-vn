/**
 * Unit tests for lib/account/validateDisplayName.ts
 */

import { describe, it, expect } from 'vitest';
import { validateDisplayName, DISPLAY_NAME_MIN, DISPLAY_NAME_MAX } from '../validateDisplayName';

describe('validateDisplayName', () => {
  it('accepts a 4-grapheme name', () => {
    expect(validateDisplayName('Anh!')).toBeNull();
  });

  it('accepts a 100-grapheme name (boundary)', () => {
    const name = 'A'.repeat(100);
    expect(validateDisplayName(name)).toBeNull();
  });

  it('rejects a 3-grapheme name (too short)', () => {
    const err = validateDisplayName('Anh');
    expect(err).toBe('TOO_SHORT');
  });

  it('rejects a 101-grapheme name (too long)', () => {
    const name = 'A'.repeat(101);
    const err = validateDisplayName(name);
    expect(err).toBe('TOO_LONG');
  });

  it('accepts Vietnamese grapheme clusters that are multi-byte', () => {
    // 'Nguyễn' contains the grapheme 'ễ' which is multi-byte but 1 grapheme
    const name = 'Nguyễn Văn An'; // 14 graphemes (spaces + letters)
    expect(validateDisplayName(name)).toBeNull();
  });

  it('rejects empty string', () => {
    expect(validateDisplayName('')).toBe('TOO_SHORT');
  });

  it('exports correct constants', () => {
    expect(DISPLAY_NAME_MIN).toBe(4);
    expect(DISPLAY_NAME_MAX).toBe(100);
  });
});
