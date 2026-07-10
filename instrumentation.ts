/**
 * Next.js 16 instrumentation hook (Issue 061 + Issue 281).
 *
 * `register()` runs once per server runtime at startup — the canonical place to
 * initialize server-side observability.
 *
 * When SENTRY_DSN is set and the runtime is Node.js, the Sentry server SDK is
 * initialized with PII scrubbing in `beforeSend` (belt-and-suspenders — our
 * captureException/captureMessage already scrub, but this catches any direct
 * SDK call that bypasses the abstraction).
 *
 * Client init: `instrumentation-client.ts` initializes the browser SDK.
 */

export async function register(): Promise<void> {
  if (process.env.SENTRY_DSN && process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs');
    const { scrubPii } = await import('@/lib/observability/sentry');

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0,
      beforeSend(event) {
        if (event.extra) {
          event.extra = scrubPii(event.extra) as Record<string, unknown>;
        }
        if (event.contexts) {
          event.contexts = scrubPii(event.contexts) as typeof event.contexts;
        }
        return event;
      },
    });
  }
}
