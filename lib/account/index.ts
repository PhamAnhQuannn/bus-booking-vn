// account domain public API barrel (SYS20 rule 3).

export { deleteAccount } from './anonymizeCustomer';
export { changePassword, ChangePasswordError } from './changePassword';
export { changePhone, ChangePhoneError } from './changePhone';
export { sendCustomerAccountOtp, verifyCustomerAccountOtp } from './customerOtp';
export { forgotPassword } from './forgotPassword';
export { resetPassword, ResetPasswordError } from './resetPassword';
export { updateName, UpdateNameError } from './updateName';
