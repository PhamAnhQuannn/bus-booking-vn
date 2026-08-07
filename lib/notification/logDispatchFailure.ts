import { logger } from '@/lib/logger';
import { captureException } from '@/lib/observability';
import type { SendEmailResult } from './email';
import type { SendSmsResult } from './esms';

/**
 * Surfaces a definitive notification-dispatch failure (P20 / #442).
 *
 * The synchronous OTP-send paths (sendOtp, customerOtp) otherwise discard the send
 * result and return {ok:true}, so a Resend/eSMS outage or a misrouted recipient is
 * invisible in our own logs. This logs a structured warn (no PII — never the
 * recipient or code) and reports to Sentry. It does NOT decide what to tell the
 * client — the caller keeps returning its enumeration-safe response.
 */
export function logNotificationDispatchFailure(
  area: string,
  result: SendEmailResult | SendSmsResult
): void {
  if (result.ok) return;
  const outcome = 'outcome' in result ? result.outcome : undefined;
  logger.warn({ area, outcome: outcome ?? 'unspecified' }, 'notification.dispatch_failed');
  captureException(new Error(result.error ?? 'notification_dispatch_failed'), { area });
}
