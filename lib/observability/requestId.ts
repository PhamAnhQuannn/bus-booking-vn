/**
 * Request-id propagation (Issue 061, AC2/AC3).
 *
 * A single `x-request-id` header is read-or-minted at the Edge proxy
 * (proxy.ts) and propagated onto BOTH the forwarded request headers (so
 * downstream route handlers + server components can read it) AND the response
 * headers (so clients + logs can correlate a response to its request).
 *
 * `loggerForRequest(rid)` returns a pino child logger bound to that id, so any
 * handler that wants correlated structured logs can do:
 *
 *     const log = loggerForRequest(getOrCreateRequestId(req.headers));
 *     log.info({ ... }, 'handler.event');
 *
 * Stage-1 enhancement (deferred): thread the id implicitly through
 * AsyncLocalStorage so handlers don't have to read the header by hand. This
 * issue ships the header propagation + the explicit `loggerForRequest` seam.
 */

import { logger } from '@/lib/logger';
import type { Logger } from 'pino';

/** The canonical request-correlation header. Lowercase — HTTP headers are case-insensitive. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Return the inbound `x-request-id` if present, else mint a fresh UUID.
 * `crypto.randomUUID()` is available in both the Node and Edge runtimes.
 */
export function getOrCreateRequestId(headers: Headers): string {
  const existing = headers.get(REQUEST_ID_HEADER);
  if (existing && existing.trim().length > 0) return existing;
  return crypto.randomUUID();
}

/** A pino child logger bound to `requestId` for correlated structured logs. */
export function loggerForRequest(requestId: string): Logger {
  return logger.child({ requestId });
}
