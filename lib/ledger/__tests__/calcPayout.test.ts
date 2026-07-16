/**
 * Unit tests for calcPayout and halfEvenRound.
 * Issue 016 — operator revenue reporting.
 */

import { describe, it, expect } from 'vitest';
import { calcPayout, halfEvenRound } from '../calcPayout';

describe('halfEvenRound', () => {
  it.each([
    // Exact 0.5 midpoints — round to nearest even
    [0.5, 0],
    [1.5, 2],
    [2.5, 2],
    [3.5, 4],
    [4.5, 4],
    [50.5, 50],
    [51.5, 52],
    [52.5, 52],
    // Non-midpoints — standard rounding
    [0.4, 0],
    [0.6, 1],
    [1.4, 1],
    [1.6, 2],
    [74074.02, 74074],
    [74074.8, 74075],
  ])('halfEvenRound(%s) === %s', (input, expected) => {
    expect(halfEvenRound(input)).toBe(expected);
  });
});

describe('calcPayout', () => {
  it.each([
    // Standard 6% fee cases
    {
      label: '1_000_000 VND gross',
      input: { grossPaidBookings: 1_000_000 },
      expected: { gross: BigInt(1_000_000), platformFee: BigInt(60_000), net: BigInt(940_000) },
    },
    {
      label: '1_234_567 VND gross (non-round — 1234567 × 0.06 = 74074.02 → 74074)',
      input: { grossPaidBookings: 1_234_567 },
      expected: { gross: BigInt(1_234_567), platformFee: BigInt(74_074), net: BigInt(1_160_493) },
    },
    {
      label: '100_000_000 VND gross',
      input: { grossPaidBookings: 100_000_000 },
      expected: { gross: BigInt(100_000_000), platformFee: BigInt(6_000_000), net: BigInt(94_000_000) },
    },
    // Zero
    {
      label: 'zero gross',
      input: { grossPaidBookings: 0 },
      expected: { gross: BigInt(0), platformFee: BigInt(0), net: BigInt(0) },
    },
    // Half-even tie: 101 × 0.5 = 50.5 → rounds to 50 (even)
    {
      label: 'half-even tie: 50.5 → 50',
      input: { grossPaidBookings: 101, platformFeePct: 0.5 },
      expected: { gross: BigInt(101), platformFee: BigInt(50), net: BigInt(51) },
    },
    // Half-even tie: 103 × 0.5 = 51.5 → rounds to 52 (even)
    {
      label: 'half-even tie: 51.5 → 52',
      input: { grossPaidBookings: 103, platformFeePct: 0.5 },
      expected: { gross: BigInt(103), platformFee: BigInt(52), net: BigInt(51) },
    },
  ])('$label', ({ input, expected }) => {
    expect(calcPayout(input)).toEqual(expected);
  });

  it('net === gross - platformFee invariant holds for all cases', () => {
    const cases = [1_000_000, 1_234_567, 100_000_000, 0, 99, 1_500_000];
    for (const gross of cases) {
      const result = calcPayout({ grossPaidBookings: gross });
      expect(result.net).toBe(result.gross - result.platformFee);
    }
  });
});
