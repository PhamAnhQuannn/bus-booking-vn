import { describe, it, expect } from 'vitest';
import { generateBookingRef, BOOKING_REF_REGEX } from '../bookingRef';

describe('generateBookingRef', () => {
  it('matches the BB-YYYY-XXXX-XXXX format', () => {
    const ref = generateBookingRef();
    expect(ref).toMatch(BOOKING_REF_REGEX);
  });

  it('uses lowercase base36 in the random segments', () => {
    for (let i = 0; i < 50; i++) {
      const ref = generateBookingRef();
      const [, , a, b] = ref.split('-');
      expect(a).toMatch(/^[0-9a-z]{4}$/);
      expect(b).toMatch(/^[0-9a-z]{4}$/);
    }
  });

  it('uses Asia/Ho_Chi_Minh year (UTC+7) — crosses date boundary correctly', () => {
    // 2026-12-31 23:30 UTC is 2027-01-01 06:30 in Asia/Ho_Chi_Minh.
    const utcLateDec = new Date(Date.UTC(2026, 11, 31, 23, 30, 0));
    const ref = generateBookingRef(utcLateDec);
    expect(ref.startsWith('BB-2027-')).toBe(true);
  });

  it('produces highly variable refs across calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateBookingRef());
    // 8 base36 chars = 36^8 ≈ 2.8e12 — 200 calls should never collide
    expect(seen.size).toBe(200);
  });
});
