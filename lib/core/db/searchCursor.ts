/**
 * Opaque seek-cursor codec for the customer search results page (Issue 097).
 *
 * Isolated from the Prisma client so the codec can be unit-tested without a
 * DATABASE_URL (searchTrips.ts imports the Prisma client at module scope,
 * which makes it unreachable in the unit test environment).
 *
 * Cursor format: `${departureAtISO}_${id}`
 *   - ISO instants never contain `_`; CUIDs never contain `_`
 *   - The FIRST `_` is the sole separator; `indexOf('_')` is safe and unambiguous
 */

/** Decoded compound seek cursor: the `(departureAt, id)` of the last visible row. */
export interface SeekCursor {
  departureAt: Date;
  id: string;
}

/**
 * Encode a row's `(departureAt, id)` seek key into an opaque cursor string.
 * Mirrors the listOperatorBookings convention (last visible row → next cursor).
 */
export function encodeCursor(departureAtIso: string, id: string): string {
  return `${departureAtIso}_${id}`;
}

/** Decode an opaque cursor back to its `(departureAt, id)`; returns null if malformed. */
export function decodeCursor(cursor: string | null | undefined): SeekCursor | null {
  if (!cursor) return null;
  const sep = cursor.indexOf('_');
  if (sep <= 0 || sep === cursor.length - 1) return null;
  const iso = cursor.slice(0, sep);
  const id = cursor.slice(sep + 1);
  const departureAt = new Date(iso);
  if (Number.isNaN(departureAt.getTime())) return null;
  return { departureAt, id };
}
