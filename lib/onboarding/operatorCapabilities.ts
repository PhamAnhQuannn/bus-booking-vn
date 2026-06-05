/**
 * Issue 045: per-state operator capability helper.
 *
 * This is the SINGLE source of truth for what an operator can do in each
 * approval state. Gates (search, trip-detail, booking-initiate — Issue 046),
 * the operator console UI, and any future policy code MUST derive their
 * decisions from this helper rather than re-typing status literals. Adding or
 * changing a capability means editing THIS file and nowhere else.
 *
 * Capability semantics (S05):
 *  - canLogin       : operator may authenticate into the console at all.
 *  - searchVisible  : operator's trips appear in customer search results.
 *  - canSell        : operator may take new bookings (trips are bookable).
 *  - canPayout      : operator's available balance may be paid out.
 *  - canResubmit    : operator may resubmit their application (REJECTED only).
 *  - listingsHidden : operator's listings are pulled with a reason (SUSPENDED).
 */

import type { OperatorStatus } from '@prisma/client';

export interface OperatorCapabilities {
  canLogin: boolean;
  searchVisible: boolean;
  canSell: boolean;
  canPayout: boolean;
  canResubmit: boolean;
  listingsHidden: boolean;
}

const NONE: OperatorCapabilities = {
  canLogin: false,
  searchVisible: false,
  canSell: false,
  canPayout: false,
  canResubmit: false,
  listingsHidden: false,
};

/**
 * Returns the capability set for an operator in the given status. Every
 * OperatorStatus is handled explicitly (no default fall-through) so adding a
 * new enum value forces a compile-time decision here.
 */
export function getOperatorCapabilities(status: OperatorStatus): OperatorCapabilities {
  switch (status) {
    // Pre-approval: may log in and draft buses/routes/trips, but nothing is
    // sellable or visible to customers and no money moves.
    case 'PENDING_REVIEW':
    case 'UNDER_REVIEW':
      return { ...NONE, canLogin: true };

    // Approved: full capability. Not resubmitting, listings not hidden.
    case 'APPROVED':
      return {
        canLogin: true,
        searchVisible: true,
        canSell: true,
        canPayout: true,
        canResubmit: false,
        listingsHidden: false,
      };

    // Rejected: may log in only to read the reason and resubmit.
    case 'REJECTED':
      return { ...NONE, canLogin: true, canResubmit: true };

    // Suspended: may log in (to see the reason) but listings are pulled and
    // selling / payouts are frozen.
    case 'SUSPENDED':
      return { ...NONE, canLogin: true, listingsHidden: true };
  }
}

/**
 * The set of OperatorStatus values whose trips are visible in customer search.
 * Derived from getOperatorCapabilities — NOT a hand-typed literal list — so the
 * gate (Issue 046) and this helper can never drift. Today this is exactly
 * {APPROVED}, but consumers must read this constant, not the literal.
 */
export const SEARCH_VISIBLE_STATUSES: OperatorStatus[] = (
  ['PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'] as OperatorStatus[]
).filter((s) => getOperatorCapabilities(s).searchVisible);

/**
 * The set of OperatorStatus values whose trips may be booked (hold → booking).
 * Derived from `canSell`. Used by the booking-initiate re-check (Issue 046) to
 * close the suspend-after-search race.
 */
export const BOOKABLE_STATUSES: OperatorStatus[] = (
  ['PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'] as OperatorStatus[]
).filter((s) => getOperatorCapabilities(s).canSell);

/** True when an operator in this status is search-visible (single-source predicate). */
export function isSearchVisible(status: OperatorStatus): boolean {
  return getOperatorCapabilities(status).searchVisible;
}

/** True when an operator in this status may sell / be booked (single-source predicate). */
export function isBookable(status: OperatorStatus): boolean {
  return getOperatorCapabilities(status).canSell;
}
