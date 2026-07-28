/**
 * Hold-domain error types extracted from holdRepo so they can be imported
 * in route handlers and unit tests without pulling in the Prisma client.
 * (Same isolation pattern as lib/db/searchCursor.ts — Issue 098.)
 */

/** Max simultaneous active holds one phone number may hold (Issue 098). */
export const CONCURRENT_HOLD_CAP = 5;

/**
 * Max SEATS one session may hold at once, across every hold and every phone (#359).
 *
 * The phone cap alone does not bound seats: `ticketCount` is per-hold and capped at 10
 * (lib/core/validation/hold.ts), so CONCURRENT_HOLD_CAP × 10 = 50 seats from one
 * regex-valid, never-verified phone — enough to lock a 45-seat trip in five requests,
 * nowhere near the 60/min IP limit. Phase 1 has no customer auth, so `buyerPhone` is
 * attacker-chosen and cannot be the ceiling.
 *
 * Set to 10 so a single family booking 10 seats in ONE hold still succeeds — that is the
 * legitimate case the per-hold max was sized for — while 50-seats-across-five does not.
 */
export const SESSION_SEAT_CAP = 10;

/** Thrown by createHold when the caller already holds CONCURRENT_HOLD_CAP active holds. */
export class HoldCapExceededError extends Error {
  constructor() {
    super('HOLD_CAP_EXCEEDED');
    this.name = 'HoldCapExceededError';
  }
}

/** Thrown by createHold when this session's active seats would exceed SESSION_SEAT_CAP. */
export class SessionSeatCapExceededError extends Error {
  constructor() {
    super('SESSION_SEAT_CAP_EXCEEDED');
    this.name = 'SessionSeatCapExceededError';
  }
}

/**
 * Thrown by createHold when the trip's advisory lock stayed contended across every
 * bounded retry (#362).
 *
 * Semantically the OPPOSITE of the two caps above, and the distinction has to survive
 * all the way to the UI: a cap means "you are holding your allowance" and only clears
 * when the caller's own holds expire; this means "the seat map is busy right now" and
 * clears in seconds. Telling a contended buyer they hold too many seats — when they
 * hold none — is the failure mode this separate type exists to prevent.
 */
export class SeatMapBusyError extends Error {
  constructor() {
    super('SEAT_MAP_BUSY');
    this.name = 'SeatMapBusyError';
  }
}

/**
 * Thrown by createHold when the caller's OWN session or phone lock stayed contended
 * across every bounded retry.
 *
 * Split out from SeatMapBusyError for the reason that type's own docblock gives. Once
 * the session and phone locks became try-locks too, all three contention sources threw
 * SeatMapBusyError — and its user-facing copy says "many people are booking this trip
 * right now". For a session/phone conflict that is false: the only party contending is
 * the caller themselves, via a double-click, two open tabs, or a retried submit. Nobody
 * else is booking the trip.
 *
 * That is the same class of lie the caps-vs-busy split was created to avoid, just on a
 * different axis, so it gets the same treatment: a distinct type carrying "your own
 * request is still in flight — try again", which is both true and actionable.
 *
 * Like SeatMapBusyError this clears in milliseconds, so it is retryable; unlike a cap it
 * has nothing to do with the caller's allowance.
 */
export class RequestInFlightError extends Error {
  constructor() {
    super('REQUEST_IN_FLIGHT');
    this.name = 'RequestInFlightError';
  }
}

/**
 * Attempts (including the first) createHold makes before surfacing a contention error.
 *
 * The name is historical: this was sized in #362 for the TRIP lock alone. It is now the
 * shared budget for all three try-locks, so one retry is consumed whichever lock was
 * contended.
 *
 * Raised 3 → 6 on evidence, not intuition. At 3, the existing cap integration tests
 * started failing the moment session and phone became try-locks: with N=6 parallel holds
 * from ONE phone, the callers that lost the phone-lock race exhausted their retries and
 * surfaced RequestInFlightError instead of the HoldCapExceededError they had come for.
 * The cap was never breached — that is a message-quality failure, not a safety one — but
 * "you are at your hold limit" is the answer the caller actually needs, and they only get
 * it by reaching the cap check.
 *
 * 6 covers a caller contending with CONCURRENT_HOLD_CAP of their own in-flight requests,
 * which is the worst self-contention the caps themselves permit. Cheap, because
 * withBoundedRetry sleeps OUTSIDE the transaction: a waiting retry holds no pooled
 * connection, so the extra attempts cost latency on an already-degraded path and nothing
 * else. Full jitter keeps the ceiling from being reached in the common case.
 */
export const TRIP_LOCK_ATTEMPTS = 6;
/** First backoff ceiling in ms; doubles per attempt, then full-jittered. */
export const TRIP_LOCK_BACKOFF_BASE_MS = 40;
