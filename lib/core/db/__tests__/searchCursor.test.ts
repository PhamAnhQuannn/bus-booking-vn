/**
 * Unit tests for the searchTrips seek-cursor codec (Issue 097).
 *
 * Pure functions — no DB. Runs in the default (non-integration) vitest suite.
 * Guards the opaque `${departureAtISO}_${id}` round-trip and malformed-input
 * tolerance the page/API rely on when reading the URL cursor.
 */

import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor } from '../searchCursor';

describe('searchTrips cursor codec (Issue 097)', () => {
  const iso = '2026-06-10T08:30:00.000Z';
  const id = 'clz9k3abc0001x8t1exampleid';

  it('round-trips a (departureAt, id) seek key', () => {
    const cursor = encodeCursor(iso, id);
    const decoded = decodeCursor(cursor);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(id);
    expect(decoded!.departureAt.toISOString()).toBe(iso);
  });

  it('splits on the FIRST underscore only (ISO + CUID never contain "_", but be safe)', () => {
    // Even if an id somehow contained an underscore, the first-split rule keeps
    // the full id intact.
    const weirdId = 'abc_def_ghi';
    const decoded = decodeCursor(encodeCursor(iso, weirdId));
    expect(decoded!.id).toBe(weirdId);
    expect(decoded!.departureAt.toISOString()).toBe(iso);
  });

  it('returns null for null/undefined/empty', () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  it('returns null for malformed cursors (no separator, trailing/leading sep, bad date)', () => {
    expect(decodeCursor('nounderscorehere')).toBeNull();
    expect(decodeCursor('_idonly')).toBeNull(); // leading sep → empty ISO half
    expect(decodeCursor('2026-06-10T08:30:00.000Z_')).toBeNull(); // trailing sep → empty id
    expect(decodeCursor('not-a-date_someid')).toBeNull(); // unparseable instant
  });
});
