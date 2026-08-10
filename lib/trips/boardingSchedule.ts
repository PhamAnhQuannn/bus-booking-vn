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

/** Narrow an unknown Prisma JSON value to a validated BoardingStop[]. */
export function parseBoardingSchedule(value: unknown): BoardingStop[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (x): x is BoardingStop =>
      x != null &&
      typeof x === 'object' &&
      typeof (x as { point?: unknown }).point === 'string' &&
      typeof (x as { time?: unknown }).time === 'string',
  );
}
