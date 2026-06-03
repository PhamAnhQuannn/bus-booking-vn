/**
 * Error type for platform-admin CLI core operations (Issue 020).
 *
 * Kept Next.js-free so the node-only admin CLI container can import it.
 */

export type AdminErrorCode =
  | 'phone_in_use'
  | 'operator_not_found'
  | 'operator_user_not_found'
  | 'already_disabled'
  // Issue 057 — super-admin bootstrap / invite / lost-TOTP recovery
  | 'email_in_use'
  | 'forbidden'
  | 'no_self_reset'
  | 'admin_not_found'
  // Issue 070 — System tab admin-account management
  | 'no_self_revoke'
  | 'no_self_role_change'
  | 'invalid_role';

export class AdminServiceError extends Error {
  constructor(public readonly code: AdminErrorCode) {
    super(code);
    this.name = 'AdminServiceError';
  }
}
