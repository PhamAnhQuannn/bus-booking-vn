/**
 * Issue 081: unit tests for the charter-request reference generator.
 */

import { describe, it, expect } from 'vitest';
import { generateCharterRef, CHARTER_REF_REGEX } from '../charterRef';

describe('generateCharterRef', () => {
  it('matches the CH-YYYY-XXXXXX format (CHARTER_REF_REGEX)', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCharterRef()).toMatch(CHARTER_REF_REGEX);
    }
  });

  it('embeds the Asia/Ho_Chi_Minh year', () => {
    const ref = generateCharterRef(new Date('2026-06-02T12:00:00+07:00'));
    expect(ref.startsWith('CH-2026-')).toBe(true);
  });

  it('uses an uppercase 6-char base36 segment', () => {
    const ref = generateCharterRef();
    const segment = ref.split('-')[2];
    expect(segment).toHaveLength(6);
    expect(segment).toMatch(/^[0-9A-Z]{6}$/);
  });

  it('produces distinct refs across many draws (no obvious constant)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateCharterRef());
    // Collisions are astronomically unlikely; assert near-full uniqueness.
    expect(seen.size).toBeGreaterThan(95);
  });

  it('CHARTER_REF_REGEX rejects lowercase / wrong-width segments', () => {
    expect(CHARTER_REF_REGEX.test('CH-2026-abc123')).toBe(false); // lowercase
    expect(CHARTER_REF_REGEX.test('CH-2026-ABC12')).toBe(false); // too short
    expect(CHARTER_REF_REGEX.test('CH-2026-ABC1234')).toBe(false); // too long
    expect(CHARTER_REF_REGEX.test('OP-2026-ABC123')).toBe(false); // wrong prefix
  });
});
