// notification domain public API barrel (SYS20 rule 3).

export {
  getTestOtp,
  stashTestOtp,
  renderTemplate,
  sendSms,
  sendSmsBody,
  SUPPORT_EMAIL,
  SUPPORT_HOTLINE,
  OPS_EMAIL,
} from './esms';
export { dispatchNotifications } from './dispatchNotifications';
export { sendEmail, renderEmailSubject } from './email';
export type { SendEmailInput, SendEmailResult, EmailTemplate } from './email';
