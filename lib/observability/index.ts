/**
 * Observability barrel (Issue 061).
 *
 *   captureException / captureMessage — error-reporting seam (Sentry deferred,
 *     logger fallback sink, PII-scrubbed). See ./sentry.ts.
 *   getOrCreateRequestId / loggerForRequest / REQUEST_ID_HEADER — request-id
 *     correlation. See ./requestId.ts.
 */

export { captureException, captureMessage, scrubPii } from './sentry';
export {
  REQUEST_ID_HEADER,
  getOrCreateRequestId,
  loggerForRequest,
} from './requestId';
