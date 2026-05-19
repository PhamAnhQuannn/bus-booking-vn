/**
 * Unit tests for windowsOverlap — pure interval-vs-interval predicate.
 *
 * Honors Issue 001 Mistake Log: window-vs-window overlap, encoded as
 *   OR: [maintenanceStart null, maintenanceEnd < startUtc, maintenanceStart > endUtc]
 *
 * The helper here is the boolean form for use in route handlers /
 * pre-validation. The Prisma WHERE-clause encoding lives in
 * `searchTrips.ts` and `getMaintenanceConflicts.ts`.
 */

import { describe, it, expect } from 'vitest';
import { windowsOverlap, type Window } from '../windowsOverlap';

const W = (start: string, end: string): Window => ({
  start: new Date(start),
  end: new Date(end),
});

describe('windowsOverlap', () => {
  it('returns true when windows fully overlap', () => {
    const a = W('2026-06-01T00:00:00Z', '2026-06-05T00:00:00Z');
    const b = W('2026-06-02T00:00:00Z', '2026-06-04T00:00:00Z');
    expect(windowsOverlap(a, b)).toBe(true);
  });

  it('returns true when windows partially overlap (left edge)', () => {
    const a = W('2026-06-01T00:00:00Z', '2026-06-05T00:00:00Z');
    const b = W('2026-05-30T00:00:00Z', '2026-06-02T00:00:00Z');
    expect(windowsOverlap(a, b)).toBe(true);
  });

  it('returns true when windows partially overlap (right edge)', () => {
    const a = W('2026-06-01T00:00:00Z', '2026-06-05T00:00:00Z');
    const b = W('2026-06-04T00:00:00Z', '2026-06-10T00:00:00Z');
    expect(windowsOverlap(a, b)).toBe(true);
  });

  it('returns true when windows touch at a single point (inclusive)', () => {
    const a = W('2026-06-01T00:00:00Z', '2026-06-05T00:00:00Z');
    const b = W('2026-06-05T00:00:00Z', '2026-06-10T00:00:00Z');
    expect(windowsOverlap(a, b)).toBe(true);
  });

  it('returns false when b is strictly before a', () => {
    const a = W('2026-06-10T00:00:00Z', '2026-06-15T00:00:00Z');
    const b = W('2026-06-01T00:00:00Z', '2026-06-05T00:00:00Z');
    expect(windowsOverlap(a, b)).toBe(false);
  });

  it('returns false when b is strictly after a', () => {
    const a = W('2026-06-01T00:00:00Z', '2026-06-05T00:00:00Z');
    const b = W('2026-06-10T00:00:00Z', '2026-06-15T00:00:00Z');
    expect(windowsOverlap(a, b)).toBe(false);
  });

  it('returns true when a is contained within b', () => {
    const a = W('2026-06-02T00:00:00Z', '2026-06-03T00:00:00Z');
    const b = W('2026-06-01T00:00:00Z', '2026-06-05T00:00:00Z');
    expect(windowsOverlap(a, b)).toBe(true);
  });

  it('uses comparator independent of wall-clock now (Issue 001 rule)', () => {
    // Both windows are in the past; overlap must still be true.
    const a = W('2020-01-01T00:00:00Z', '2020-01-10T00:00:00Z');
    const b = W('2020-01-05T00:00:00Z', '2020-01-15T00:00:00Z');
    expect(windowsOverlap(a, b)).toBe(true);
  });
});
