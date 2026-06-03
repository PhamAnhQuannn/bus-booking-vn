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

export { CharterError, type CharterErrorCode } from './errors';
