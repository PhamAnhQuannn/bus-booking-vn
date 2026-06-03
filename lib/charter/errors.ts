/**
 * Issue 081: tagged error type for charter-request state transitions.
 *
 * The transition service throws ONLY for exceptional outcomes (illegal edge,
 * missing row). Normal outcomes are returned as a discriminated result — see
 * lib/charter/charterStatus.ts (Issue 013: no-throw-for-idempotent / normal).
 */

export type CharterErrorCode =
  | 'charter_not_found'
  | 'illegal_transition';

export class CharterError extends Error {
  constructor(
    public readonly code: CharterErrorCode,
    /** Optional human context, e.g. `SUBMITTED -> ACCEPTED`. */
    public readonly detail?: string
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'CharterError';
  }
}
