/**
 * checkCustomerActive — single source of truth for "is this customer allowed to
 * authenticate right now" (P4). A soft-deleted (`deletedAt`) OR admin-suspended
 * (`suspendedAt`) customer must not pass.
 *
 * Shared by every gate that mints or accepts a customer session so the checks
 * cannot drift: `requireCustomerAuth` (Bearer-token re-validation), `authService.login`
 * (P8 — suspended login), and the Google OAuth callback (P3). Kept as a pure,
 * throw-free predicate because each caller needs a different response shape
 * (`INVALID_CREDENTIALS` + dummyVerify for login; 401 vs 403 for the guard; a
 * redirect for the callback).
 *
 * Deletion takes precedence over suspension: a deleted account should be
 * indistinguishable from a nonexistent one (401), never surfaced as "suspended".
 */
export interface CustomerActiveCheck {
  suspendedAt: Date | null;
  deletedAt: Date | null;
}

export type CustomerActiveResult =
  | { active: true }
  | { active: false; reason: 'deleted' | 'suspended' };

export function checkCustomerActive(customer: CustomerActiveCheck): CustomerActiveResult {
  if (customer.deletedAt !== null) return { active: false, reason: 'deleted' };
  if (customer.suspendedAt !== null) return { active: false, reason: 'suspended' };
  return { active: true };
}
