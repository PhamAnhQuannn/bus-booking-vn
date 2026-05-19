/**
 * Window-vs-window overlap predicate.
 *
 * Honors Issue 001 Mistake Log: maintenance overlap is computed window-vs-window,
 * never against `new Date()` wall-clock. Two intervals [aStart, aEnd] and
 * [bStart, bEnd] overlap iff aStart <= bEnd AND aEnd >= bStart (inclusive).
 *
 * The Prisma WHERE-clause encoding of the same rule for the trip-side check is
 *   OR: [maintenanceStart null, maintenanceEnd < startUtc, maintenanceStart > endUtc]
 * (negation = "no overlap with [startUtc, endUtc]").
 */

export interface Window {
  start: Date;
  end: Date;
}

export function windowsOverlap(a: Window, b: Window): boolean {
  return a.start.getTime() <= b.end.getTime() && a.end.getTime() >= b.start.getTime();
}
