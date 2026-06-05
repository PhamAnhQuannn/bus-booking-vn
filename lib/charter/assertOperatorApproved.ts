/**
 * Issue 083: APPROVED gate for operator-side charter actions.
 *
 * Charter is an APPROVED-only capability (S14 / Issue 046). An operator that is
 * PENDING_REVIEW / UNDER_REVIEW / REJECTED / SUSPENDED must NOT be able to see or
 * act on directly-assigned charter leads. The gate derives its decision from the
 * single source of truth `getOperatorCapabilities(status).canSell` (today that is
 * exactly {APPROVED}) — never a hand-typed status literal, so it can never drift
 * from the Issue 045/046 capability matrix.
 *
 * Two surfaces consume this:
 *   - charter route handlers (accept/decline) → call `assertOperatorApproved`,
 *     which THROWS CharterNotApprovedError (mapped to 403 by the route).
 *   - the charter tab RSC → calls `isOperatorApproved` (boolean, no throw) so it
 *     can render an "available after approval" notice instead of erroring.
 */

import type { OperatorStatus } from '@prisma/client';
import { getOperatorCapabilities } from '@/lib/onboarding';

/** Minimal Prisma surface this helper needs (operator status read). */
export interface OperatorStatusClient {
  operator: {
    findUnique: (args: {
      where: { id: string };
      select: { status: true };
    }) => Promise<{ status: OperatorStatus } | null>;
  };
}

/** Thrown by assertOperatorApproved when the operator is not APPROVED. */
export class CharterNotApprovedError extends Error {
  constructor() {
    super('operator_not_approved');
    this.name = 'CharterNotApprovedError';
  }
}

/**
 * True when an operator in this status may act on charter (the canSell capability
 * — APPROVED-only). Pure predicate; reused by the RSC notice branch and the route.
 */
export function isCharterEnabled(status: OperatorStatus): boolean {
  // charter is an APPROVED-only capability; canSell is the single-source predicate.
  return getOperatorCapabilities(status).canSell;
}

/**
 * Reads the operator's status and returns whether charter is enabled. Never
 * throws on a non-APPROVED operator (returns false); throws only if the operator
 * row is missing (treated as not-found upstream by the caller if needed). Used by
 * the RSC so it can render the approval notice.
 */
export async function isOperatorApproved(
  prisma: OperatorStatusClient,
  operatorId: string
): Promise<boolean> {
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: { status: true },
  });
  if (!operator) return false;
  return isCharterEnabled(operator.status);
}

/**
 * Route-side gate: throws CharterNotApprovedError (→ 403) unless the operator is
 * charter-enabled (APPROVED). Call at the top of every charter route handler
 * AFTER requireOperatorAuth has resolved ctx.operatorId.
 */
export async function assertOperatorApproved(
  prisma: OperatorStatusClient,
  operatorId: string
): Promise<void> {
  const approved = await isOperatorApproved(prisma, operatorId);
  if (!approved) {
    throw new CharterNotApprovedError();
  }
}
