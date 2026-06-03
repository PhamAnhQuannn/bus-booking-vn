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

export {
  OperatorStatusError,
  type OperatorStatusErrorCode,
  RegisterError,
  type RegisterErrorCode,
} from './errors';

export {
  registerOperator,
  REGISTER_SLA_RANGE,
  type RegisterOperatorInput,
  type RegisterOperatorResult,
} from './registerOperator';

export { generateApplicationRef, APPLICATION_REF_REGEX } from './applicationRef';
