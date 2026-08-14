// auth domain public API barrel (SYS20 rule 3).

export { adminLogin } from './adminAuthService';
export {
  issueAdminSession,
  revokeAdminSession,
  rotateAdminRefresh,
  verifyAdminRefreshToken,
} from './adminSession';
export { beginEnrollment, confirmEnrollment, verifyLoginTotp } from './adminTotp';
export {
  login,
  logout,
  refresh,
  register,
  verifyOtp,
  createCustomerSession,
  AuthServiceError,
} from './authService';
export { getGoogleClient, GOOGLE_OAUTH_SCOPES } from './googleOAuthClient';
export {
  resolveGoogleLogin,
  type GoogleIdentityInput,
  type ResolveGoogleResult,
} from './linkGoogleAccount';
export { readCsrfToken } from './csrfClient';
export { generateToken as generateCsrfToken } from './csrf';
export { rotateCsrf } from './csrfRotate';
export {
  signAccess,
  verifyAccess,
  signOperatorAccess,
  verifyOperatorAccess,
  signAdminAccess,
  signAdminStepUp,
  verifyAdminStepUp,
  verifyAdminAccess,
  type AccessPayload,
  type OperatorAccessPayload,
  type AdminAccessPayload,
} from './jwt';
export { operatorLogin, operatorLoginStep2 } from './operatorAuthService';
export type { OperatorLoginResult, OperatorAuthResult, OperatorOtpRequiredResult } from './operatorAuthService';
export { buildUsername, buildAcronym, last4, ensureUniqueUsername } from './operatorUsername';
export { sendOperatorPasswordResetOtp, verifyOperatorOtp } from './operatorOtp';
export { sendOperatorLoginOtp, verifyOperatorLoginOtp } from './operatorLoginOtp';
export {
  issueOperatorSession,
  revokeOperatorSession,
  revokeAllOperatorSessions,
  rotateOperatorRefresh,
  verifyOpRefreshToken,
} from './operatorSession';
export { generateCode, generateSalt, hashCode } from './otp';
export { issueOtpProof, verifyOtpProof } from './otpProof';
export {
  GOAUTH_COOKIE_NAME,
  buildGoauthSetCookieHeader,
  buildGoauthClearCookieHeader,
  readGoauthCookie,
  type GoauthState,
} from './goauthCookie';
export { verifyGoogleIdToken, type GoogleIdentity } from './googleIdToken';
export { hash, verify } from './password';
export { requireAdminAuth, type AdminAuthContext } from './requireAdminAuth';
export { requireAdminPage } from './requireAdminPage';
export {
  checkCustomerActive,
  type CustomerActiveCheck,
  type CustomerActiveResult,
} from './assertCustomerActive';
export {
  requireCustomerAuth,
  getCustomerOptional,
  type CustomerAuthContext,
} from './requireCustomerAuth';
export { requireOperatorAuth, type OperatorAuthContext } from './requireOperatorAuth';
export { requireStepUp } from './requireStepUp';
export { safeReturnTo } from './safeReturnTo';
export { sendOtp } from './sendOtp';
export {
  ChangePasswordSchema,
  CustomerForgotPasswordVerifySchema,
  ForgotPasswordSchema,
  ForgotPasswordVerifySchema,
  ForgotPasswordResetSchema,
  PatchOperatorProfileSchema,
  passwordSchema,
  phoneSchema,
} from './types';
