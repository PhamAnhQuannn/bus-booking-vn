/**
 * Issue 045: operator onboarding / approval state machine barrel.
 */

export {
  getOperatorCapabilities,
  SEARCH_VISIBLE_STATUSES,
  BOOKABLE_STATUSES,
  isSearchVisible,
  isBookable,
  type OperatorCapabilities,
} from './operatorCapabilities';

export {
  LEGAL_OPERATOR_TRANSITIONS,
  isLegalOperatorTransition,
  transitionOperatorStatus,
  type TransitionOperatorStatusInput,
  type TransitionOperatorStatusResult,
} from './operatorStatus';

export { OperatorStatusError, type OperatorStatusErrorCode } from './errors';
