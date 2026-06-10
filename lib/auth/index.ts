// auth domain public API barrel (SYS20 rule 3).

export { adminLogin } from './adminAuthService';
export {
  issueAdminSession,
  revokeAdminSession,
  rotateAdminRefresh,
  verifyAdminRefreshToken,
} from './adminSession';
export { beginEnrollment, confirmEnrollment, verifyLoginTotp } from './adminTotp';
export { isAdminTotpDisabled } from './totpDisabled';
export { login, logout, refresh, register, verifyOtp, AuthServiceError } from './authService';
export { readCsrfToken } from './csrfClient';
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
export { operatorLogin } from './operatorAuthService';
export { buildUsername, buildAcronym, last4, ensureUniqueUsername } from './operatorUsername';
export { sendOperatorPasswordResetOtp, verifyOperatorOtp } from './operatorOtp';
export {
  issueOperatorSession,
  revokeOperatorSession,
  revokeAllOperatorSessions,
  rotateOperatorRefresh,
  verifyOpRefreshToken,
} from './operatorSession';
export { generateCode, generateSalt, hashCode } from './otp';
export { issueOtpProof, verifyOtpProof } from './otpProof';
export { hash, verify } from './password';
export { requireAdminAuth, type AdminAuthContext } from './requireAdminAuth';
export { requireAdminPage } from './requireAdminPage';
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
  ForgotPasswordSchema,
  ForgotPasswordVerifySchema,
  ForgotPasswordResetSchema,
  PatchOperatorProfileSchema,
  passwordSchema,
  phoneSchema,
} from './types';
