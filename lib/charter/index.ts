/**
 * Issue 081: charter-request state machine + ref barrel.
 */

export {
  LEGAL_CHARTER_TRANSITIONS,
  isLegalCharterTransition,
  transitionCharterRequest,
  type CharterTransitionClient,
  type CharterTransitionTx,
  type TransitionCharterRequestInput,
  type TransitionCharterRequestResult,
} from './charterStatus';

export { generateCharterRef, CHARTER_REF_REGEX } from './charterRef';

export { CharterError, type CharterErrorCode } from './errors';
