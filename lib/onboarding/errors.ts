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

/**
 * Issue 076: tagged error type for self-serve operator registration.
 *
 * `phone_in_use` — the login phone (OperatorUser.phone @unique) already belongs
 * to another operator account. The route maps this to HTTP 409.
 */
export type RegisterErrorCode = 'phone_in_use';

export class RegisterError extends Error {
  constructor(
    public readonly code: RegisterErrorCode,
    public readonly detail?: string
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'RegisterError';
  }
}
