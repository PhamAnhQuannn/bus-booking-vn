/**
 * Issue 045: tagged error type for operator approval-state transitions.
 */

export type OperatorStatusErrorCode =
  | 'operator_not_found'
  | 'illegal_transition';

export class OperatorStatusError extends Error {
  constructor(
    public readonly code: OperatorStatusErrorCode,
    /** Optional human context, e.g. `APPROVED → PENDING_REVIEW`. */
    public readonly detail?: string
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'OperatorStatusError';
  }
}
