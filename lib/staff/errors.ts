/**
 * Typed service-layer error for operator staff management (Issue 017).
 *
 * Route handlers translate each code to its AC-specified HTTP status:
 *   - phone_in_use            → 409 (unique phone collision on create)
 *   - not_found               → 404 (no such staff, or cross-operator access)
 *   - trip_not_assignable     → 422 (trip cancelled / departed / completed)
 *   - trip_not_found          → 404 (trip missing or owned by another operator)
 *
 * Codes are sourced from the Issue 017 acceptance criteria verbatim.
 */

export type StaffErrorCode =
  | 'phone_in_use'
  | 'not_found'
  | 'trip_not_assignable'
  | 'trip_not_found';

export class StaffServiceError extends Error {
  constructor(public code: StaffErrorCode) {
    super(code);
    this.name = 'StaffServiceError';
  }
}
