// notification domain public API barrel (SYS20 rule 3).

export {
  getTestOtp,
  stashTestOtp,
  renderTemplate,
  sendSms,
  sendSmsBody,
  SUPPORT_EMAIL,

  OPS_ALERT_EMAIL,
} from './esms';
export { dispatchNotifications, MAX_ATTEMPTS } from './dispatchNotifications';
export { sendEmail, renderEmailSubject } from './email';
export type { SendEmailInput, SendEmailResult, EmailTemplate } from './email';
export type { SendSmsInput, SendSmsResult, SmsTemplate } from './esms';
export { logNotificationDispatchFailure } from './logDispatchFailure';
