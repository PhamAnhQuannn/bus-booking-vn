/**
 * Error type for platform-admin CLI core operations (Issue 020).
 *
 * Kept Next.js-free so the node-only admin CLI container can import it.
 */

export type AdminErrorCode =
  | 'phone_in_use'
  | 'operator_not_found'
  | 'operator_user_not_found'
  | 'already_disabled';

export class AdminServiceError extends Error {
  constructor(public readonly code: AdminErrorCode) {
    super(code);
    this.name = 'AdminServiceError';
  }
}
