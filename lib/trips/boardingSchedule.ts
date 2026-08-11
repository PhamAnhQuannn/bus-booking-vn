/**
 * Boarding schedule = the staggered pickup points + times of a single physical trip
 * (one bus, many stops). Stored display-only as JSON on Route.boardingSchedule; never
 * used as a query predicate or for seat accounting.
 */

export interface BoardingStop {
  /** Pickup point name, e.g. "Nông Cống". */
  point: string;
  /** Local pickup time "HH:MM" (Asia/Ho_Chi_Minh). */
  time: string;
}

/** "HH:MM" 24-hour, e.g. "03:00" / "23:45". Anchored so "3:0" / "24:00" are rejected. */
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Narrow an unknown Prisma JSON value to a validated BoardingStop[]. Stops whose
 *  time is not a well-formed "HH:MM" are dropped — a malformed entry would render
 *  as "Đón tại X · 3pm" and be saved onto a ticket verbatim. */
export function parseBoardingSchedule(value: unknown): BoardingStop[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (x): x is BoardingStop =>
      x != null &&
      typeof x === 'object' &&
      typeof (x as { point?: unknown }).point === 'string' &&
      typeof (x as { time?: unknown }).time === 'string' &&
      HHMM_RE.test((x as { time: string }).time),
  );
}
