/**
 * Next.js 16 instrumentation hook (Issue 061).
 *
 * `register()` runs once per server runtime at startup — the canonical place to
 * initialize server-side observability.
 *
 * STAGE-1 SEAM: the real `@sentry/nextjs` server init wires here when SENTRY_DSN
 * is set. It is DEFERRED for now (the SDK is not installed — offline /
 * dep-conscious), exactly like the refund PSP and the S3 storage stub. Until
 * then the error-reporting abstraction (lib/observability/sentry.ts) routes
 * every event to the PII-scrubbed structured-logger fallback sink.
 *
 *   export async function register() {
 *     if (process.env.SENTRY_DSN && process.env.NEXT_RUNTIME === 'nodejs') {
 *       // const Sentry = await import('@sentry/nextjs');
 *       // Sentry.init({ dsn: process.env.SENTRY_DSN, beforeSend: scrubEvent });
 *     }
 *   }
 *
 * Client init seam: when the real SDK lands, a `instrumentation-client.ts` (or
 * sentry.client.config.ts) initializes the browser SDK. Not installed / not
 * initialized here — the abstraction is the deliverable, not a live client.
 */

export async function register(): Promise<void> {
  // Intentionally empty until Stage-1. See module comment for the wiring seam.
}
