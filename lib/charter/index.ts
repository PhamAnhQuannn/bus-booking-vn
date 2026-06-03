/**
 * Issue 081: charter-request state machine + ref barrel.
 */

export {
  LEGAL_CHARTER_TRANSITIONS,
  CUSTOMER_CANCELLABLE_STATUSES,
  isLegalCharterTransition,
  transitionCharterRequest,
  type CharterTransitionClient,
  type CharterTransitionTx,
  type TransitionCharterRequestInput,
  type TransitionCharterRequestResult,
} from './charterStatus';

export { generateCharterRef, CHARTER_REF_REGEX } from './charterRef';

export {
  createCharterRequest,
  type CreateCharterRequestInput,
  type CreateCharterRequestResult,
} from './createCharterRequest';

export { getCharterByRef, type CharterByRef } from './getCharterByRef';

export {
  getAssignedCharters,
  getAcceptedCharters,
  type AssignedCharter,
  type AcceptedCharter,
} from './getOperatorCharters';

export { declineCharter, type DeclineCharterInput, type DeclineCharterResult } from './declineCharter';

export {
  assertOperatorApproved,
  isOperatorApproved,
  isCharterEnabled,
  CharterNotApprovedError,
} from './assertOperatorApproved';

export { CharterError, type CharterErrorCode } from './errors';
