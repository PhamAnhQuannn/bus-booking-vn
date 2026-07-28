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
