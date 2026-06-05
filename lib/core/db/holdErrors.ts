/**
 * Hold-domain error types extracted from holdRepo so they can be imported
 * in route handlers and unit tests without pulling in the Prisma client.
 * (Same isolation pattern as lib/db/searchCursor.ts — Issue 098.)
 */

/** Max simultaneous active holds one phone number may hold (Issue 098). */
export const CONCURRENT_HOLD_CAP = 5;

/** Thrown by createHold when the caller already holds CONCURRENT_HOLD_CAP active seats. */
export class HoldCapExceededError extends Error {
  constructor() {
    super('HOLD_CAP_EXCEEDED');
    this.name = 'HoldCapExceededError';
  }
}
